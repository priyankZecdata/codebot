from rest_framework import serializers
from .models import Todo


class TodoSerializer(serializers.ModelSerializer):
    """Todo serializer"""
    # BUG 5: API Integration Bug - Frontend expects 'is_completed' but we send 'completed'
    # Also frontend expects 'created' but we send 'created_at'
    
    class Meta:
        model = Todo
        fields = ['id', 'title', 'description', 'completed', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']