import os
from dotenv import load_dotenv
from hello_project.hello_app.bot_core import CodeBot

def print_help():
    print("""
Commands:
  upload <path> [alias]    - Upload a project once; optional alias name
  list                     - List registered projects
  use <project>           - Set active project (used by default for fixes)
  show <project>          - Show project details
  remove <project> [files] - Remove project from registry (use 'files' to delete files too)
  fix                     - Enter fix mode to fix multiple bugs in active project
  exit                     - Exit
Examples:
  upload /home/me/myproj
  upload /home/me/myproj myproj_alias
  list
  use myproj_alias
  fix                    # Enter fix mode
  > Describe bug...     # Describe each bug
  > 'done'             # Type 'done' when finished fixing bugs
""")

# Load environment variables from .env
load_dotenv()

def main():
    # Load Groq API key from .env
    GEMINI_API_KEY = os.getenv("GROQ_API_KEY")
    if not GEMINI_API_KEY:
        print("Error: GROQ_API_KEY not found in .env")
        return

    codebot = CodeBot(GEMINI_API_KEY=GEMINI_API_KEY)

    while True:
        command = input("Enter command (upload/fix/exit): ").strip()
        if command == "upload":
            project_path = input("Enter path to your project folder: ").strip()
            codebot.load_project(project_path)
        elif command == "fix":
            print("\nEntering fix mode. Type 'done' to return to main menu or 'exit' to quit.")
            while True:
                bug_description = input("\nDescribe the bug/fix requirement (or 'done'/'exit'): ").strip().lower()
                if bug_description == 'done':
                    print("Returning to main menu.")
                    break
                elif bug_description == 'exit':
                    print("Exiting CodeBot.")
                    return
                codebot.smart_fix_bug(bug_description)
        elif command == "exit":
            print("Exiting CodeBot.")
            break
        else:
            print("Invalid command. Use upload/fix/exit.")

if __name__ == "__main__":
    main()
