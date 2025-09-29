import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  IconButton,
  Avatar,
  Container,
  Chip,
  Alert,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  LinearProgress,
} from '@mui/material';
import {
  Send as SendIcon,
  Code as CodeIcon,
  SmartToy as BotIcon,
  Person as UserIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  FolderOpen as FolderOpenIcon,
  Folder as FolderIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  ExpandMore as ExpandMoreIcon,
  AttachFile as AttachFileIcon,
  CloudUpload as CloudUploadIcon,
  BugReport as BugReportIcon,
  AutoFixHigh as AutoFixHighIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// Type definitions
interface AttachedFile {
  id: number;
  name: string;
  size: number;
  type: string;
  file: File;
}

interface ProjectInfo {
  path: string;
  status: string;
}

interface PreviewItem {
  file: string;
  changes: string[];
  full_diff: string;
  fixed_code: string;
}

interface PreviewData {
  previews: PreviewItem[];
}

interface ApiResponse {
  status: string;
  message: string;
}

interface ApplyResult {
  message: string;
}

interface Message {
  id: number;
  type: 'user' | 'bot';
  content: string;
  timestamp: Date;
  attachedFiles?: AttachedFile[];
  projectInfo?: ProjectInfo;
  previewData?: PreviewData;
  showConfirmation?: boolean;
  apiResponse?: ApiResponse;
  isSuccess?: boolean;
  applyResults?: ApplyResult[];
}

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#4caf50',
      light: '#81c784',
      dark: '#388e3c',
    },
    secondary: {
      main: '#2196f3',
      light: '#64b5f6',
      dark: '#1976d2',
    },
    background: {
      default: '#0a0a0a',
      paper: '#1a1a1a',
    },
    error: {
      main: '#f44336',
    },
    warning: {
      main: '#ff9800',
    },
    success: {
      main: '#4caf50',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 500,
    },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
        },
      },
    },
  },
});

const CodeBotPage = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      type: 'bot',
      content: 'Hey developer! I\'m CodeBot AI - your intelligent bug hunting companion. Upload your project zip file and I\'ll help you squash those pesky bugs!',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentProjectPath, setCurrentProjectPath] = useState<string | null>(null);
  const [waitingForBugDescription, setWaitingForBugDescription] = useState<boolean>(false);
  const [currentBugDescription, setCurrentBugDescription] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [waitingForConfirmation, setWaitingForConfirmation] = useState<boolean>(false);
  const [workflowStep, setWorkflowStep] = useState<string>('initial');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() && attachedFiles.length === 0) return;

    const newMessage: Message = {
      id: Date.now(),
      type: 'user',
      content: inputMessage || '📁 Project file attached for analysis',
      attachedFiles: [...attachedFiles],
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newMessage]);
    const currentInput = inputMessage;
    setInputMessage('');
    const filesToUpload = [...attachedFiles];
    setAttachedFiles([]);
    setIsLoading(true);

    try {
      if (filesToUpload.length > 0) {
        await handleFileUpload(filesToUpload[0]);
      } else if (waitingForBugDescription && currentProjectPath && workflowStep === 'uploaded') {
        setCurrentBugDescription(currentInput);
        await handlePreviewFix(currentInput, currentProjectPath);
      } else if (waitingForConfirmation && workflowStep === 'preview_ready') {
        await handleUserConfirmation(currentInput.toLowerCase());
      } else {
        const botResponse: Message = {
          id: Date.now() + 1,
          type: 'bot',
          content: generateBotResponse(currentInput),
          timestamp: new Date()
        };
        setMessages(prev => [...prev, botResponse]);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      const errorResponse: Message = {
        id: Date.now() + 1,
        type: 'bot',
        content: `❌ Error: ${errorMessage}. Please try again.`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorResponse]);
    }

    setIsLoading(false);
  };

  const handleFileUpload = async (file: AttachedFile) => {
    try {
      const formData = new FormData();
      formData.append('file', file.file);
      formData.append('type', 'file');

      const response = await fetch('http://127.0.0.1:8000/api/upload/', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.status === 'uploaded' && data.project_path) {
        setCurrentProjectPath(data.project_path);
        setWaitingForBugDescription(true);
        setWorkflowStep('uploaded');
        
        const botResponse: Message = {
          id: Date.now() + 1,
          type: 'bot',
          content: `✅ Project Successfully Uploaded!\n\n📂 Project Path: \`${data.project_path}\`\n\n🐛 Please describe the issue or bug you'd like help fixing\n\nFor example:\n- "React useEffect Bug - Missing dependencies causes infinite loop"\n- "Function returning undefined instead of expected value"\n- "CSS styling not applying correctly"\n\nBe as specific as possible about the issue you're experiencing.`,
          timestamp: new Date(),
          projectInfo: {
            path: data.project_path,
            status: data.status
          }
        };
        setMessages(prev => [...prev, botResponse]);
      } else {
        throw new Error('Upload successful but no project path received');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      throw new Error(`Upload failed: ${errorMessage}`);
    }
  };

  const handlePreviewFix = async (bugDescription: string, projectPath: string) => {
    try {
      const fixUrl = `http://127.0.0.1:8000/api/fix/?desc=${encodeURIComponent(bugDescription)}&project=${encodeURIComponent(projectPath)}`;
      
      const fixResponse = await fetch(fixUrl, {
        method: 'GET',
      });

      if (!fixResponse.ok) {
        throw new Error(`Fix API failed: ${fixResponse.statusText}`);
      }

      const fixData = await fixResponse.json();
      
      const fixBotResponse: Message = {
        id: Date.now() + 1,
        type: 'bot',
        content: `🔧 Bug Fix Initiated\n\n${fixData?.message || 'Bug analysis started...'}`,
        timestamp: new Date(),
        apiResponse: fixData
      };
      setMessages(prev => [...prev, fixBotResponse]);

      const previewResponse = await fetch('http://127.0.0.1:8000/api/preview_fix/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project_path: projectPath,
          bug_description: bugDescription
        })
      });

      if (!previewResponse.ok) {
        throw new Error(`Preview API failed: ${previewResponse.statusText}`);
      }

      const previewData = await previewResponse.json();
      setPreviewData(previewData);
      setWaitingForBugDescription(false);
      setWaitingForConfirmation(true);
      setWorkflowStep('preview_ready');

      const previewBotResponse: Message = {
        id: Date.now() + 2,
        type: 'bot',
        content: `🔍 Fix Preview Generated\n\n**Files to be modified: ${previewData.previews?.length || 0}**\n\n**Step 5: Would you like to apply these fixes to your code?**\n\n💡 Type "yes" to apply all fixes, or "no" to cancel.`,
        timestamp: new Date(),
        previewData: previewData,
        showConfirmation: true
      };
      setMessages(prev => [...prev, previewBotResponse]);
      
    } catch (error) {
      setWaitingForBugDescription(false);
      setWaitingForConfirmation(false);
      setWorkflowStep('initial');
      const errorMessage = error instanceof Error ? error.message : 'Preview generation failed';
      throw new Error(`Preview generation failed: ${errorMessage}`);
    }
  };

  const handleUserConfirmation = async (userResponse: string) => {
    if (userResponse.includes('yes') || userResponse.includes('apply') || userResponse.includes('confirm')) {
      try {
        if (!previewData?.previews) {
          throw new Error('No preview data available');
        }

        const applyPromises = previewData.previews.map(async (preview: PreviewItem) => {
          const applyResponse = await fetch('http://127.0.0.1:8000/api/apply_fix/', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              file_path: preview.file,
              fixed_code: preview.fixed_code,
              prompt: 'yes'
            })
          });

          if (!applyResponse.ok) {
            throw new Error(`Apply fix failed for ${preview.file}: ${applyResponse.statusText}`);
          }

          return await applyResponse.json();
        });

        const applyResults = await Promise.all(applyPromises);
        
        setWaitingForConfirmation(false);
        setPreviewData(null);
        setCurrentProjectPath(null);
        setCurrentBugDescription(null);
        setWorkflowStep('applied');

        const successBotResponse: Message = {
          id: Date.now() + 1,
          type: 'bot',
          content: `✅Fix Applied Successfully!\n\n${applyResults.length} file(s) have been updated successfully.\n\n🎉 Workflow Complete! Your bug has been fixed and the changes have been applied to your project.\n\n💡 You can upload another project file to start a new bug-fixing session.`,
          timestamp: new Date(),
          applyResults: applyResults,
          isSuccess: true
        };
        setMessages(prev => [...prev, successBotResponse]);

      } catch (error) {
        setWaitingForConfirmation(false);
        setPreviewData(null);
        setWorkflowStep('initial');
        const errorMessage = error instanceof Error ? error.message : 'Fix application failed';
        throw new Error(`Fix application failed: ${errorMessage}`);
      }
    } else {
      setWaitingForConfirmation(false);
      setPreviewData(null);
      setCurrentProjectPath(null);
      setCurrentBugDescription(null);
      setWorkflowStep('initial');

      const declineBotResponse: Message = {
        id: Date.now() + 1,
        type: 'bot',
        content: `❌ **Fix Cancelled**\n\nNo changes were applied to your code. You can upload a new project file or describe a different bug to start over.`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, declineBotResponse]);
    }
  };

  const formatDiffView = (changes: string[]): string => {
    if (!changes || changes.length === 0) return 'No changes detected';
    
    return changes
      .map((line: string) => {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('-')) {
          return `🔴 ${line}`;
        } else if (trimmedLine.startsWith('+')) {
          return `🟢 ${line}`;
        } else {
          return `   ${line}`;
        }
      })
      .join('\n');
  };

  const generateBotResponse = (userMessage: string): string => {
    const msg = userMessage.toLowerCase();
    
    if (msg.includes('hello') || msg.includes('hi')) {
      return '👋 Hello fellow coder! Ready to debug some code? Upload a zip file of your project and let\'s eliminate those bugs together!';
    } else if (msg.includes('help')) {
      return '💡 Here\'s how to use CodeBot:\n\n1. 📁 Upload a zip file of your project\n2. 🐛 Describe the specific bug or issue\n3. 🔧 Get automated fixes and suggestions\n\nJust click the folder icon to get started!';
    } else if (msg.includes('exit')) {
      return '👋 Thanks for using CodeBot AI! Your session has been completed. Feel free to return anytime for more bug hunting!';
    } else {
      return '💻 I\'m here to help fix bugs in your code! Please upload a zip file of your project to get started, or type "help" for instructions.';
    }
  };

  const handleFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      const file = files[0];
      
      if (!file.name.toLowerCase().endsWith('.zip')) {
        const errorMessage: Message = {
          id: Date.now(),
          type: 'bot',
          content: '❌ Please upload a ZIP file only. Other file formats are not supported.',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
        return;
      }
      
      const fileObject: AttachedFile = {
        id: Date.now() + Math.random(),
        name: file.name,
        size: file.size,
        type: file.type,
        file: file
      };

      setAttachedFiles([fileObject]);
    }
  };

  const removeAttachedFile = (fileId: number) => {
    setAttachedFiles(prev => prev.filter(file => file.id !== fileId));
  };

  const clearChat = () => {
    setMessages([
      {
        id: 1,
        type: 'bot',
        content: '🔄 Chat reset! I\'m ready to help you debug your code. Upload a zip file to get started!',
        timestamp: new Date()
      }
    ]);
    setAttachedFiles([]);
    setCurrentProjectPath(null);
    setWaitingForBugDescription(false);
    setCurrentBugDescription(null);
    setPreviewData(null);
    setWaitingForConfirmation(false);
    setWorkflowStep('initial');
  };

  const formatTimestamp = (timestamp: Date): string => {
    return timestamp.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const getPlaceholderText = (): string => {
    if (waitingForBugDescription && workflowStep === 'uploaded') {
      return "Describe the bug you want me to fix...";
    } else if (waitingForConfirmation && workflowStep === 'preview_ready') {
      return 'Type "yes" to apply fix, or "no" to cancel...';
    } else if (attachedFiles.length > 0) {
      return "Press Enter to upload and analyze...";
    } else {
      return "Ask me to help fix bugs, or upload a zip file to get started...";
    }
  };

  const getStatusText = (): string => {
    switch (workflowStep) {
      case 'uploaded':
        return 'Waiting for bug description...';
      case 'bug_described':
        return 'Processing bug fix...';
      case 'preview_ready':
        return 'Awaiting confirmation to apply fix...';
      case 'applied':
        return 'Fix applied successfully!';
      default:
        return 'Advanced Bug Detection & Code Analysis Assistant';
    }
  };

  const ProjectInfoDisplay: React.FC<{ projectInfo: ProjectInfo }> = ({ projectInfo }) => (
    <Card sx={{ mt: 2, bgcolor: 'primary.dark', border: '1px solid', borderColor: 'primary.main' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <FolderIcon color="primary" />
          <Typography variant="h6" color="primary">
            Project Information
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ mb: 1 }}>
          <strong>Status:</strong> <Chip label={projectInfo.status} color="success" size="small" />
        </Typography>
        <Typography variant="body2">
          <strong>Path:</strong>
        </Typography>
        <Paper sx={{ p: 1, mt: 1, bgcolor: 'grey.900' }}>
          <Typography variant="caption" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
            {projectInfo.path}
          </Typography>
        </Paper>
      </CardContent>
    </Card>
  );

  const MultiFileDiffDisplay: React.FC<{ previewData: PreviewData }> = ({ previewData }) => (
    <Box sx={{ mt: 2 }}>
      {previewData.previews && previewData.previews.map((preview: PreviewItem, index: number) => (
        <Accordion key={index} sx={{ mb: 2, bgcolor: 'grey.900', border: '1px solid', borderColor: 'warning.main' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <BugReportIcon color="warning" />
              <Typography variant="h6" color="warning.main">
                File {index + 1}: {preview.file.split('/').pop()}
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" sx={{ mb: 2 }}>
              File: <Typography component="code" variant="caption" color="info.main">{preview.file}</Typography>
            </Typography>
            
            <Card sx={{ mb: 2, bgcolor: 'grey.800' }}>
              <CardContent>
                <Typography variant="subtitle2" color="warning.main" gutterBottom>
                  Changes Summary:
                </Typography>
                <Paper sx={{ p: 2, bgcolor: 'grey.900', maxHeight: 200, overflow: 'auto' }}>
                  <Typography component="pre" variant="caption" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                    {formatDiffView(preview.changes)}
                  </Typography>
                </Paper>
              </CardContent>
            </Card>

            {preview.full_diff && (
              <Card sx={{ mb: 2, bgcolor: 'grey.800' }}>
                <CardContent>
                  <Typography variant="subtitle2" color="secondary.main" gutterBottom>
                    Complete Diff:
                  </Typography>
                  <Paper sx={{ p: 2, bgcolor: 'grey.900', maxHeight: 200, overflow: 'auto' }}>
                    <Typography component="pre" variant="caption" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                      {preview.full_diff}
                    </Typography>
                  </Paper>
                </CardContent>
              </Card>
            )}

            <Card sx={{ bgcolor: 'grey.800' }}>
              <CardContent>
                <Typography variant="subtitle2" color="success.main" gutterBottom>
                  Updated Code:
                </Typography>
                <Paper sx={{ p: 2, bgcolor: 'grey.900', maxHeight: 250, overflow: 'auto' }}>
                  <Typography component="pre" variant="caption" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                    {preview.fixed_code || 'Code preview not available'}
                  </Typography>
                </Paper>
              </CardContent>
            </Card>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );

  const ConfirmationDisplay: React.FC = () => (
    <Alert severity="warning" icon={<AutoFixHighIcon />} sx={{ mt: 2 }}>
      <Typography variant="subtitle2" gutterBottom>
        Awaiting Confirmation
      </Typography>
      <Typography variant="body2">
        Type <strong style={{ color: '#4caf50' }}>"yes"</strong> to apply the fixes to all files, 
        or <strong style={{ color: '#f44336' }}>"no"</strong> to cancel.
      </Typography>
    </Alert>
  );

  const SuccessDisplay: React.FC<{ results?: ApplyResult[] }> = ({ results }) => (
    <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mt: 2 }}>
      <Typography variant="subtitle2" gutterBottom>
        Success!
      </Typography>
      <Typography variant="body2" gutterBottom>
        All fixes have been applied successfully to your project files.
      </Typography>
      {results && results.length > 0 && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="body2" gutterBottom>
            <strong>Files updated:</strong>
          </Typography>
          <List dense>
            {results.map((result: ApplyResult, index: number) => (
              <ListItem key={index}>
                <ListItemIcon>
                  <CheckCircleIcon color="success" />
                </ListItemIcon>
                <ListItemText primary={result.message || `File ${index + 1} updated`} />
              </ListItem>
            ))}
          </List>
        </Box>
      )}
    </Alert>
  );

  const ApiResponseDisplay: React.FC<{ response: ApiResponse }> = ({ response }) => (
    <Card sx={{ mt: 2, bgcolor: 'grey.800', border: '1px solid', borderColor: 'info.main' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <ErrorIcon color="info" />
          <Typography variant="subtitle2" color="info.main">
            API Response
          </Typography>
        </Box>
        {response?.status === 'success' ? (
          <Typography variant="body2" color="success.main">
            ✅ {response.message}
          </Typography>
        ) : (
          <Typography variant="body2" color="error.main">
            ❌ {response?.message || 'Unknown error occurred'}
          </Typography>
        )}
      </CardContent>
    </Card>
  );

  const AttachedFilesDisplay: React.FC<{ 
    files: AttachedFile[]; 
    onRemove?: (fileId: number) => void; 
    showRemove?: boolean 
  }> = ({ files, onRemove, showRemove = true }) => {
    if (files.length === 0) return null;
    
    return (
      <Box sx={{ mt: 2 }}>
        {files.map((file: AttachedFile) => (
          <Chip
            key={file.id}
            icon={<AttachFileIcon />}
            label={`${file.name} (${(file.size / 1024).toFixed(1)} KB)`}
            onDelete={showRemove && onRemove ? () => onRemove(file.id) : undefined}
            color="primary"
            variant="outlined"
            sx={{ mr: 1, mb: 1 }}
          />
        ))}
      </Box>
    );
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
        {/* Header */}
        <Paper elevation={2} sx={{ p: 2, bgcolor: 'background.paper' }}>
          <Container maxWidth="xl">
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'primary.main' }}>
                  <BotIcon />
                </Avatar>
                <Box>
                  <Typography variant="h4" color="primary">
                    CodeBot AI
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {getStatusText()}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {currentProjectPath && (
                  <Chip
                    label="Project Loaded"
                    color="success"
                    icon={<CheckCircleIcon />}
                  />
                )}
                <Button
                  onClick={clearChat}
                  startIcon={<DeleteIcon />}
                  variant="outlined"
                  color="error"
                >
                  Clear Chat
                </Button>
              </Box>
            </Box>
          </Container>
        </Paper>

        {/* Messages */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          <Container maxWidth="lg">
            {messages.map((message: Message) => (
              <Box
                key={message.id}
                sx={{
                  display: 'flex',
                  justifyContent: message.type === 'user' ? 'flex-end' : 'flex-start',
                  mb: 3,
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    gap: 2,
                    maxWidth: '80%',
                    flexDirection: message.type === 'user' ? 'row-reverse' : 'row',
                  }}
                >
                  <Avatar
                    sx={{
                      bgcolor: message.type === 'user' ? 'secondary.main' : 'primary.main',
                      flexShrink: 0,
                    }}
                  >
                    {message.type === 'user' ? <UserIcon /> : <CodeIcon />}
                  </Avatar>
                  <Paper
                    elevation={2}
                    sx={{
                      p: 2,
                      bgcolor: message.type === 'user' ? 'secondary.dark' : 'background.paper',
                    }}
                  >
                    <Typography
                      variant="body1"
                      sx={{ whiteSpace: 'pre-line', wordBreak: 'break-word' }}
                    >
                      {message.content}
                    </Typography>
                    {message.attachedFiles && (
                      <AttachedFilesDisplay files={message.attachedFiles} showRemove={false} />
                    )}
                    {message.projectInfo && (
                      <ProjectInfoDisplay projectInfo={message.projectInfo} />
                    )}
                    {message.previewData && (
                      <MultiFileDiffDisplay previewData={message.previewData} />
                    )}
                    {message.showConfirmation && <ConfirmationDisplay />}
                    {message.apiResponse && !message.previewData && (
                      <ApiResponseDisplay response={message.apiResponse} />
                    )}
                    {message.isSuccess && (
                      <SuccessDisplay results={message.applyResults} />
                    )}
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                      {formatTimestamp(message.timestamp)}
                    </Typography>
                  </Paper>
                </Box>
              </Box>
            ))}
            {isLoading && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 3 }}>
                <Box sx={{ display: 'flex', gap: 2, maxWidth: '80%' }}>
                  <Avatar sx={{ bgcolor: 'primary.main', flexShrink: 0 }}>
                    <CodeIcon />
                  </Avatar>
                  <Paper elevation={2} sx={{ p: 2, bgcolor: 'background.paper' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <CircularProgress size={20} color="primary" />
                      <Typography variant="body2" color="primary">
                        {attachedFiles.length > 0 ? 'Uploading project...' : 
                        waitingForBugDescription ? 'Processing bug analysis...' : 
                        waitingForConfirmation ? 'Generating preview...' :
                        'Processing...'}
                      </Typography>
                    </Box>
                  </Paper>
                </Box>
              </Box>
            )}
            <div ref={messagesEndRef} />
          </Container>
        </Box>

        {/* Input Area */}
        <Paper elevation={3} sx={{ p: 2, bgcolor: 'background.paper' }}>
          <Container maxWidth="lg">
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
              <Box sx={{ flex: 1 }}>
                {attachedFiles.length > 0 && (
                  <Box sx={{ mb: 1 }}>
                    {attachedFiles.map(file => (
                      <Chip
                        key={file.id}
                        icon={<AttachFileIcon />}
                        label={file.name}
                        onDelete={() => removeAttachedFile(file.id)}
                        color="primary"
                        variant="outlined"
                        size="small"
                        sx={{ mr: 1 }}
                      />
                    ))}
                  </Box>
                )}
                <TextField
                  fullWidth
                  multiline
                  maxRows={4}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                  placeholder={getPlaceholderText()}
                  disabled={isLoading}
                  variant="outlined"
                  InputProps={{
                    endAdornment: (
                      !waitingForBugDescription && !waitingForConfirmation && (
                        <Tooltip title="Select ZIP File">
                          <IconButton
                            onClick={() => fileInputRef.current?.click()}
                            color="primary"
                          >
                            <CloudUploadIcon />
                          </IconButton>
                        </Tooltip>
                      )
                    ),
                  }}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip"
                  onChange={handleFileSelection}
                  style={{ display: 'none' }}
                />
              </Box>
              <Button
                onClick={handleSendMessage}
                disabled={(!inputMessage.trim() && attachedFiles.length === 0) || isLoading}
                variant="contained"
                size="large"
                endIcon={<SendIcon />}
                sx={{
                  minWidth: '120px',
                  height: '56px',
                  background: 'linear-gradient(45deg, #4caf50 30%, #2196f3 90%)',
                  '&:hover': {
                    background: 'linear-gradient(45deg, #388e3c 30%, #1976d2 90%)',
                  },
                }}
              >
                Send
              </Button>
            </Box>
          </Container>
        </Paper>
      </Box>
    </ThemeProvider>
  );
};

export default CodeBotPage;