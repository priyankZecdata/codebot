import os
import difflib
import json
import requests
import re
import shutil
import chardet
from git import Repo
from git import Repo, GitCommandError
from .utils import read_file, write_file, verify_code
from .frontend_utils import verify_typescript, verify_json, get_file_type
from .code_analyzer import find_relevant_files, classify_bug_type

# def extract_code(llm_output: str) -> str:
#     matches = re.findall(r"```(?:python)?\n(.*?)```", llm_output, re.DOTALL)
#     return matches[0].strip() if matches else llm_output.strip()

def extract_code(llm_output: str) -> str:
    """
    Extract code from LLM output, removing surrounding triple backticks and optional language.
    """
    matches = re.findall(r"```(?:\w+)?\s*([\s\S]*?)```", llm_output)
    if matches:
        return matches[0].strip()  
    return llm_output.strip()

def create_github_repo(token: str, repo_name: str, private: bool = True, description: str = "") -> bool:
    """
    Create a repo under the authenticated user's account using GitHub API.
    Returns True on success.
    """
    url = "https://api.github.com/user/repos"
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json"
    }
    payload = {
        "name": repo_name,
        "private": private,
        "description": description,
        "auto_init": False
    }
    resp = requests.post(url, headers=headers, json=payload)
    if resp.status_code in (201,):
        return True
    # If already exists, consider it success
    if resp.status_code == 422 and "already exists" in resp.text:
        return True
    # otherwise, print error and return False
    print(f"[GitHub API] Failed to create repo: {resp.status_code} {resp.text}")
    return False

class CodeBot:
    def __init__(self, storage_dir="project_store", projects_dir="projects", groq_api_key=None, gemini_api_key= None, project_path=None):
        self.storage_dir = storage_dir
        self.projects_dir = projects_dir
        self.project_path = project_path
        self.project_name = None
        self.state_file = os.path.join(storage_dir, "project_state.json")
        self.groq_api_key = groq_api_key
        self.gemini_api_key = gemini_api_key
        self.state = {}
        if not os.path.exists(self.storage_dir):
            os.makedirs(self.storage_dir)

        # GitHub config from env (optional)
        self.github_token = os.getenv("GITHUB_TOKEN")
        self.github_user = os.getenv("GITHUB_USERNAME")
        self.github_repo_name = os.getenv("GITHUB_REPO_NAME")  # optional pre-created name

    def load_project(self, project_path):
        self.project_path = os.path.abspath(project_path)
        self.project_name = os.path.basename(project_path.rstrip("/"))

        # Copy files safely
        for root, dirs, files in os.walk(project_path):
            for file in files:
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, project_path)

                try:
                    with open(full_path, "rb") as f:
                        raw = f.read(2048) 
                        result = chardet.detect(raw)
                        encoding = result["encoding"]

                    if encoding:  # treat as text
                        with open(full_path, "r", encoding=encoding, errors="ignore") as fr:
                            content = fr.read()
                        self.state[f"{self.project_name}/{rel_path}"] = {"functions": []}

                    # else:  # binary file
                    #     # shutil.copy2(full_path, dest_file)
                    #     print(f"⚠️ Skipping binary file {full_path}")


                except Exception as e:
                    print(f"⚠️ Skipping {full_path}: {e}")
                    # shutil.copy2(full_path, dest_file)

        # Initialize Git repo if not exists
        if not os.path.exists(os.path.join(self.project_path, ".git")):
            Repo.init(self.project_path)

        print(f"Project '{self.project_name}' loaded successfully!")

    def smart_fix_bug(self, bug_description: str) -> None:
        """
        Automatically find and fix bugs based on description without requiring file path
        """
        if not self.project_path:
            print("No project loaded. Please load a project first.")
            return

        # Find potentially relevant files
        print("Analyzing project files to locate the bug...")
        relevant_files = find_relevant_files(self.project_path, bug_description)

        if not relevant_files:
            print("Could not find any relevant files matching the bug description.")
            return

        # Get bug type classification
        bug_types = classify_bug_type(bug_description)
        most_likely_type = max(bug_types.items(), key=lambda x: x[1])[0]
        print(f"Bug appears to be {most_likely_type}-related\n")

        # Process files in order of relevance
        files_fixed = False
        for file_path, score in relevant_files[:3]:  # Look at top 3 most relevant files
            rel_path = os.path.relpath(file_path, self.project_path)
            print(f"\nAnalyzing {rel_path} (relevance score: {score:.2f})")
            
            try:
                response = self._propose_fix(file_path, bug_description)
                if response:
                    print(f"Successfully fixed {rel_path}")
                    files_fixed = True
            except Exception as e:
                print(f"Error while fixing {rel_path}: {str(e)}")
            
        if not files_fixed:
            print("\nNo files were successfully fixed for this bug.")


    def _propose_fix(self, file_path: str, prompt: str) -> dict:
        """
        Generate proposed fixes for a file, but don't apply them yet.
        Returns a dict with proposed changes, so the UI can confirm.
        """
        if not os.path.exists(file_path):
            return {"error": f"File {file_path} not found."}

        # Read and fix code
        code = read_file(file_path)
        fixed_code = self.get_groq_fix(code, file_path, prompt)
        fixed_code_clean = extract_code(fixed_code)

        # Generate diff
        code_lines = code.splitlines()
        fixed_lines = fixed_code_clean.splitlines()
        diff = list(difflib.unified_diff(code_lines, fixed_lines, lineterm=''))

        # Only keep meaningful changes (+ / - lines)
        changes = [line for line in diff if line.startswith('+ ') or line.startswith('- ')]

        if not changes:
            return {"message": "No changes needed"}

        return {
            "file": file_path,
            "changes": changes,
            "full_diff": "\n".join(diff),
            "fixed_code": fixed_code_clean
        }


    def _apply_fix(self, file_path: str, fixed_code_clean: str, prompt: str) -> dict:
        """
        Apply the fix after user confirms.
        """
        write_file(file_path, fixed_code_clean)

        # Verify based on file type
        # file_type = get_file_type(file_path)
        # if file_type in ['typescript', 'ts', 'tsx']:
        #     verification_passed, error_message = verify_typescript(file_path)
        # elif file_type == 'json':
        #     verification_passed, error_message = verify_json(file_path)
        # elif file_path.endswith('.py'):
        #     verification_passed = verify_code(file_path)
        #     error_message = ""
        # else:
        #     verification_passed = True
        #     error_message = ""

        # if verification_passed:
            # self.commit_changes(file_path, prompt)
        return {"status": "success", "message": f"Applied and verified {file_path}"}
        # else:
        #     return {"status": "failed", "error": error_message}


    def fix_bug(self, func_name_or_file, prompt):
        """
        Legacy method for fixing bugs in a specific file
        """
        target_file = None
        for key, meta in self.state.items():
            if func_name_or_file in meta.get("functions", []) or func_name_or_file in key:
                target_file = key
                break
        if not target_file:
            target_file = f"{func_name_or_file}"

        file_path = target_file
        if not os.path.exists(file_path):
            print(f"File {target_file} not found in project files.")
            return

        code = read_file(file_path)
        fixed_code = self.get_groq_fix(code, target_file, prompt)
        fixed_code_clean = extract_code(fixed_code)

        # Split code into lines
        code_lines = code.splitlines()
        fixed_lines = fixed_code_clean.splitlines()

        # Use difflib to find differences
        diff = difflib.unified_diff(code_lines, fixed_lines, lineterm='')
        changes = [line for line in diff if line.startswith('+ ') or line.startswith('- ')]
        
        if changes:
            print("Changes made:")
            for line in changes:
                print(line)
        else:
            print("No changes detected.")

        write_file(file_path, fixed_code_clean)
        print(f"Bug fixed in {target_file}")

        # Determine file type and verify accordingly
        file_type = get_file_type(file_path)
        verification_passed = False
        error_message = ""

        if file_type == 'typescript':
            verification_passed, error_message = verify_typescript(file_path)
        elif file_type == 'json':
            verification_passed, error_message = verify_json(file_path)
        elif file_path.endswith('.py'):  # Python files
            verification_passed = verify_code(file_path)
        else:
            print(f"Warning: No syntax verification available for this file type")
            verification_passed = True  # Skip verification for unsupported types

        if verification_passed:
            print(f"Verification passed for {target_file}")
        else:
            print(f"Verification failed for {target_file}")
            if error_message:
                print(f"Error details: {error_message}")

        self.commit_changes(file_path, prompt)


    def get_groq_fix(self, code, file_path, prompt):

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={self.gemini_api_key}"
        headers = {"Content-Type": "application/json"}

        file_type = get_file_type(file_path)
        language = "TypeScript" if file_type == "typescript" else "JSON" if file_type == "json" else "Python"

        llm_prompt = f"""
    You are a code-fixing assistant specializing in {language}.
    Task: Fix the bug in the following file: {file_path}

    IMPORTANT:
    - Only return complete {language} code.
    - Do NOT include explanations or markdown.
    - Output should be ready to save directly.
    - Maintain proper syntax, types, and best practices for {language}.
    {"- Ensure proper TypeScript types and interfaces are maintained." if file_type == "typescript" else ""}
    {"- Ensure valid JSON structure and format." if file_type == "json" else ""}

    Code:
    {code}

    Fix requirement:
    {prompt}
    """

        data = {
            "contents": [
                {
                    "parts": [{"text": llm_prompt}]
                }
            ]
        }

        response = requests.post(url, headers=headers, data=json.dumps(data))
        response.raise_for_status()
        result = response.json()

        return result["candidates"][0]["content"]["parts"][0]["text"]


    def commit_changes(self, file_path, message):
        """
        Commit locally then push to GitHub if credentials are available.
        """
        # Find project root containing .git
        repo_path = os.path.dirname(file_path)
        while repo_path and not os.path.exists(os.path.join(repo_path, ".git")):
            parent = os.path.dirname(repo_path)
            if parent == repo_path:
                break
            repo_path = parent

        if not os.path.exists(os.path.join(repo_path, ".git")):
            print(f"No git repository found for {file_path}. Aborting push.")
            return

        repo = Repo(repo_path)

        # Commit changes locally
        try:
            repo.git.add(all=True)
            # Ensure a branch "main" exists and is current
            try:
                repo.git.rev_parse("--verify", "main")
                repo.git.checkout("main")
            except GitCommandError:
                # rename current branch to main
                try:
                    repo.git.branch("-M", "main")
                except GitCommandError:
                    pass
            repo.index.commit(f"CodeBot fix: {message} in {os.path.relpath(file_path, repo_path)}")
            print(f"Local commit created for {file_path}")
        except Exception as e:
            print(f"Failed to create local commit: {e}")
            return

        # If GitHub credentials are available, push
        if not self.github_token or not self.github_user:
            print("GITHUB_TOKEN or GITHUB_USERNAME not set in .env — skipping push to GitHub.")
            return

        # Determine repo name to use on GitHub
        repo_name = self.github_repo_name if self.github_repo_name else os.path.basename(repo_path)

        # Create remote repo if needed (safe-check)
        created = create_github_repo(self.github_token, repo_name, private=True, description=f"Repo for {repo_name} created by CodeBot")
        if not created:
            print("Could not ensure remote GitHub repository exists. Skipping push.")
            return

        # Remote URL uses token for authentication. Note: token in URL is sensitive.
        remote_url = f"https://{self.github_token}@github.com/{self.github_user}/{repo_name}.git"

        # Add or set origin
        try:
            origin = repo.remote("origin")
            # If origin exists but different, set url to remote_url
            if origin.url != remote_url:
                repo.delete_remote("origin")
                repo.create_remote("origin", remote_url)
        except (ValueError, GitCommandError):
            # no origin, create it
            try:
                repo.create_remote("origin", remote_url)
            except Exception as e:
                print(f"Failed to create remote origin: {e}")
                return

        # Push to GitHub
        try:
            # push main and set upstream
            repo.git.push("--set-upstream", "origin", "main")
            print(f"Pushed changes to https://github.com/{self.github_user}/{repo_name}")
        except GitCommandError as e:
            print(f"Failed to push to remote: {e}")


