import subprocess
import os

def read_file(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()

def write_file(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

def verify_code(file_path):
    """
    Try to compile the Python file to check for syntax errors.
    Returns True if compilation succeeds, False otherwise.
    """
    try:
        # Use python found on PATH; for portability use sys.executable in advanced setups
        subprocess.check_output(["python3", "-m", "py_compile", file_path], stderr=subprocess.STDOUT)
        return True
    except subprocess.CalledProcessError as e:
        try:
            print(e.output.decode())
        except Exception:
            print(e.output)
        return False
