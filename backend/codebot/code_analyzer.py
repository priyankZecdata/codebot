import os
import re
from typing import List, Dict, Tuple

EXCLUDE_DIRS = {"venv", "__pycache__", ".git", "codebot"}

def analyze_file_content(file_path: str, bug_description: str) -> float:
    """
    Analyze a file's content to determine how likely it is to contain the described bug.
    Returns a score between 0 and 1, where 1 means highly likely.
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read().lower()
        
        # Convert description to lowercase for case-insensitive matching
        bug_description = bug_description.lower()
        
        # Extract key terms from bug description
        key_terms = set(re.findall(r'\w+', bug_description))
        
        # Count matching terms in the content
        matches = sum(1 for term in key_terms if term in content)
        
        # Calculate basic relevance score
        score = matches / len(key_terms) if key_terms else 0
        
        # Boost score based on specific indicators
        if 'error' in content and 'error' in bug_description:
            score += 0.2
        if 'bug' in content and 'bug' in bug_description:
            score += 0.2
            
        return min(score, 1.0)  # Cap at 1.0
    except:
        return 0.0

def find_relevant_files(project_path: str, bug_description: str, min_score: float = 0.3) -> List[Tuple[str, float]]:
    """
    Find files that are likely to contain the described bug.
    Returns a list of (file_path, relevance_score) tuples.
    """
    relevant_files = []
    project_path = project_path.strip()

    for root, dirs, files in os.walk(project_path):

        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS and not d.startswith('.') and not d.endswith('env')]

        for file in files:
            if file.startswith('.') and any(excluded in file for excluded in EXCLUDE_DIRS):
                continue
            if file.endswith(('.py', '.tsx', '.ts', '.js', '.jsx', '.json', '.css', '.html')):
                file_path = os.path.join(root, file)
                try:
                    score = analyze_file_content(file_path, bug_description)
                except Exception as e:
                    print(f"Error analyzing {file_path}: {e}")
                    continue
                if score >= min_score:
                    relevant_files.append((file_path, score))

    
    # Sort by relevance score in descending order
    relevant_files.sort(key=lambda x: x[1], reverse=True)
    return relevant_files

def classify_bug_type(bug_description: str) -> Dict[str, float]:
    """
    Classify the type of bug to help determine which files to look at.
    Returns a dict of bug type probabilities.
    """
    bug_types = {
        'syntax': 0.0,
        'runtime': 0.0,
        'typescript': 0.0,
        'frontend': 0.0,
        'backend': 0.0,
        'style': 0.0
    }
    
    description = bug_description.lower()
    
    # Syntax related
    if any(word in description for word in ['syntax', 'parsing', 'compile', 'typo', 'missing', 'bracket', 'parenthesis']):
        bug_types['syntax'] += 0.8
        
    # Runtime related
    if any(word in description for word in ['runtime', 'crash', 'exception', 'undefined', 'null']):
        bug_types['runtime'] += 0.8
        
    # TypeScript specific
    if any(word in description for word in ['type', 'interface', 'typescript', '.tsx', '.ts']):
        bug_types['typescript'] += 0.8
        
    # Frontend specific
    if any(word in description for word in ['ui', 'display', 'screen', 'component', 'render', 'style', 'css', 'html']):
        bug_types['frontend'] += 0.8
        
    # Backend specific
    if any(word in description for word in ['api', 'database', 'server', 'endpoint', 'request']):
        bug_types['backend'] += 0.8
        
    # Style related
    if any(word in description for word in ['style', 'css', 'layout', 'design', 'position']):
        bug_types['style'] += 0.8
        
    return bug_types
