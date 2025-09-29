from django.urls import path
from . import views

urlpatterns = [
    path("upload/", views.upload_project, name="upload_project"),
    path("fix/", views.fix_bug_view, name="fix_bug_view"),
    path("preview_fix/", views.preview_fix, name="preview_fix"),
    path('apply_fix/', views.apply_fix, name='apply_fix'),
]

