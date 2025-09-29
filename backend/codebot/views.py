import os
from unittest import result
from dotenv import load_dotenv
import zipfile
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from .bot_core import CodeBot, find_relevant_files, extract_code, read_file, difflib, write_file, get_file_type, verify_typescript, verify_json, verify_code
from rest_framework.decorators import api_view
from rest_framework.response import Response
from pathlib import Path
import json

load_dotenv()

UPLOAD_DIR = os.path.join(settings.MEDIA_ROOT, "projects")
os.makedirs(UPLOAD_DIR, exist_ok=True)
EXCLUDE = {
    "__pycache__", "venv", "env", ".env", ".git",
    "node_modules", "dist", "build", ".idea", ".vscode"
}

MAX_DEPTH = 3

def get_folder_structure(path: str, depth: int = MAX_DEPTH):
    """Recursively build folder structure as a dictionary, excluding unwanted files/folders."""
    path = Path(path)
    
    # Skip excluded files/folders
    if path.name in EXCLUDE or path.name.startswith(".") or path.name.endswith(('env')):
        return None
    
    if path.is_file():
        return path.name

    structure = {}
    for child in path.iterdir():
        child_struct = get_folder_structure(child, depth - 1)
        if child_struct:  # skip excluded or empty
            structure[child.name] = child_struct

    return structure if structure else None

@csrf_exempt
def upload_project(request):
    """Register a project by taking the current working directory (no upload)."""
    if request.method == "POST":
        try:
            # Use current working directory
            backend_path = Path(settings.BASE_DIR)
            project_path = str(backend_path.parent)
            if not project_path:
                return JsonResponse(
                    {"status": "error", "message": "Missing project_path"},
                    status=400
                )

            if not os.path.exists(project_path):
                return JsonResponse(
                    {"status": "error", "message": f"Path not found: {project_path}"},
                    status=400
                )

            # Load project into CodeBot state
            bot = CodeBot(project_path=project_path, groq_api_key=os.getenv("GEMINI_API_KEY"), gemini_api_key=os.getenv("GEMINI_API_KEY"))
            bot.load_project(project_path)

            folder_structure = get_folder_structure(str(project_path))


            return JsonResponse({
                "status": "loaded",
                "project_path": os.path.abspath(project_path),
                "folder_structure": folder_structure,
                "message": f"Project '{os.path.basename(project_path)}' loaded successfully"
            })

        except Exception as e:
            return JsonResponse({"status": "error", "message": str(e)}, status=500)

    return JsonResponse({"error": "Only POST allowed"}, status=405)



def fix_bug_view(request):
    """Fix bug in uploaded project"""
    bug_description = request.GET.get("desc")
    project_path = request.GET.get("project")
    print("project_path", project_path)

    if not bug_description or not project_path:
        return JsonResponse({
            "status": "error",
            "message": "Please provide both ?desc and ?project params"
        }, status=400)

    groq_api_key = os.getenv("GROQ_API_KEY")
    gemini_api_key= os.getenv("GEMINI_API_KEY")
    if not groq_api_key:
        print("Error: GROQ_API_KEY not found in .env")
        return JsonResponse({
            "status": "error",
            "message": "GROQ_API_KEY not configured"
        }, status=500)

    # Call the CodeBot to fix the bug
    bot = CodeBot(project_path=project_path, groq_api_key=groq_api_key, gemini_api_key=gemini_api_key)
    bot.smart_fix_bug(bug_description)

    return JsonResponse({
        "status": "success",
        "filePathwithName": "",  # or actual file path if available
        "message": f"Bug fixing started for: {bug_description}"
    }, status=200)


@csrf_exempt
def preview_fix(request):
    if request.method != "POST":
        return JsonResponse({"error": "Only POST allowed"}, status=405)

    try:
        body = json.loads(request.body.decode("utf-8"))
        bug_description = body.get("bug_description")
        project_path = body.get("project_path")


        bot = CodeBot(groq_api_key=os.getenv("GROQ_API_KEY"), gemini_api_key= os.getenv("GEMINI_API_KEY"))
        bot.project_path = project_path  # Set project path from request

        relevant_files = find_relevant_files(bot.project_path, bug_description)
        if not relevant_files:
            return JsonResponse({"message": "No relevant files found for this bug."})

        previews = []
        for file_path, score in relevant_files[:3]:
            preview = bot._propose_fix(file_path, bug_description)
            previews.append(preview)

        return JsonResponse({"previews": previews}, safe=False)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
def apply_fix(request):
    if request.method != "POST":
        return JsonResponse({"error": "Only POST allowed"}, status=405)

    try:
        body = json.loads(request.body.decode("utf-8"))
        file_path = body.get("file_path")
        fixed_code = body.get("fixed_code")
        fixed_code = fixed_code.strip("```")
        prompt = body.get("prompt", "")

        if not file_path or not fixed_code:
            return JsonResponse({"error": "file_path and fixed_code are required"}, status=400)
        
        if prompt.strip().lower() != "yes":
            return JsonResponse({
                "status": "skipped",
                "message": "Fix not applied because prompt was not 'Yes'"
            })


        bot = CodeBot(groq_api_key=os.getenv("GROQ_API_KEY"))
        result = bot._apply_fix(file_path, fixed_code, prompt)

        return JsonResponse(result, safe=False)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({"error": str(e)}, status=500)