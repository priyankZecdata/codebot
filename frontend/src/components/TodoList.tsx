import React, { useState, useEffect } from 'react';
import {
  List,
  ListItem,
  Paper,
  Typography,
  Box,
  CircularProgress,
  Alert
} from '@mui/material';
import TodoItem from './TodoItem';
import { getTodos, updateTodo, deleteTodo, Todo } from '../services/api';

const TodoList: React.FC = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const fetchTodos = async () => {
    try {
      const data = await getTodos();
      setTodos(data);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to fetch todos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUpdate = async (id: number, updates: Partial<Todo>) => {
    try {
      const updatedTodo = await updateTodo(id, updates);
      setTodos(prev =>
        prev.map(todo => (todo.id === id ? updatedTodo : todo))
      );
    } catch (err: any) {
      setError(err.message || 'Failed to update todo');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteTodo(id);
      setTodos(prev => prev.filter(todo => todo.id !== id));
    } catch (err: any) {
      setError(err.message || 'Failed to delete todo');
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Paper sx={{ mt: 2, p: 2 }}>
      <Typography variant="h5" gutterBottom>
        Your Todos
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {todos.length === 0 ? (
        <Typography color="text.secondary" align="center" py={4}>
          No todos yet. Create one above!
        </Typography>
      ) : (
        <List>
          {todos.map(todo => (
            <ListItem key={todo.id} disablePadding>
              <TodoItem
                todo={todo}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            </ListItem>
          ))}
        </List>
      )}
    </Paper>
  );
};

export default TodoList;