const API_BASE = '/api';

// Get CSRF token from cookie
function getCsrfTokenFromCookie(): string {
  const name = 'csrftoken';
  const cookies = document.cookie.split(';');
  for (let cookie of cookies) {
    const trimmed = cookie.trim();
    if (trimmed.startsWith(name + '=')) {
      return trimmed.substring(name.length + 1);
    }
  }
  return '';
}

// API call helper
async function apiCall(
  endpoint: string, 
  options: RequestInit = {}
): Promise<any> {
  const csrfToken = getCsrfTokenFromCookie();
  const method = options.method || 'GET';
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers as HeadersInit,
  };

  if (['POST', 'PUT', 'DELETE'].includes(method.toUpperCase())) {
    (headers as any)['X-CSRFToken'] = csrfToken;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    method,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || 'Request failed');
  }

  return response.json();
}

// Auth functions
export async function getCsrfToken() {
  return apiCall('/csrf/');
}

export async function login(username: string, password: string) {
  return apiCall('/login/', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export async function logout() {
  return apiCall('/logout/', {
    method: 'POST',
  });
}

export async function checkAuth() {
  return apiCall('/check/');
}

// Todo CRUD operations
export interface Todo {
  id: number;
  title: string;
  description: string;
  is_completed: boolean;
  created: string;
}

export async function getTodos(): Promise<Todo[]> {
  return apiCall('/todos/');
}

export async function createTodo(data: Partial<Todo>): Promise<Todo> {
  return apiCall('/todos/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateTodo(id: number, data: Partial<Todo>): Promise<Todo> {
  return apiCall(`/todos/${id}/`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteTodo(id: number): Promise<void> {
  return apiCall(`/todos/${id}/`, {
    method: 'DELETE',
  });
}
