import subprocess
import json

def verify_typescript(file_path):
    """
    Verify TypeScript/TSX syntax using tsc (TypeScript compiler)
    Returns (bool, str): (success, error_message)
    """
    try:
        # Run tsc to check syntax
        result = subprocess.run(
            ["npx", "tsc", "--noEmit", file_path],
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            return True, ""
        return False, result.stderr
    except subprocess.CalledProcessError as e:
        return False, str(e)
    except FileNotFoundError:
        return False, "TypeScript compiler (tsc) not found. Please install Node.js and TypeScript."

def verify_json(file_path):
    """
    Verify JSON syntax by attempting to parse the file
    Returns (bool, str): (success, error_message)
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            json.load(f)
        return True, ""
    except json.JSONDecodeError as e:
        return False, f"JSON syntax error: {str(e)}"
    except Exception as e:
        return False, f"Error reading JSON file: {str(e)}"

def get_file_type(file_path):
    """
    Determine the type of file based on extension
    """
    lower_path = file_path.lower()
    if lower_path.endswith('.tsx'):
        return 'typescript'
    elif lower_path.endswith('.ts'):
        return 'typescript'
    elif lower_path.endswith('.json'):
        return 'json'
    else:
        return 'unknown'