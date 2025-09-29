from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import Todo
from .serializers import TodoSerializer


class TodoViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Todo CRUD operations
    """
    serializer_class = TodoSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        # BUG 3: Permission Bug - Missing user filter, shows all todos instead of user's todos
        # Should be: return Todo.objects.filter(user=self.request.user)
        return Todo.objects.all()
    
    def perform_create(self, serializer):
        # This part is correct - saves todo with current user
        serializer.save(user=self.request.user)
