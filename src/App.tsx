import { useState, useRef, ChangeEvent } from "react";
import { analyzeMeeting } from "./services/ai";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, Calendar, CalendarDays, ClipboardList, CheckCircle2, Loader2, Mail, Sparkles, User, AlertCircle, FileText, UploadCloud, FileType, Type as TypeIcon } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

declare const google: any;

type InputMode = "text" | "file";

export default function App() {
  const [documentContent, setDocumentContent] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<InputMode | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileData, setFileData] = useState<{ mimeType: string, data: string, extension?: string } | null>(null);
  const [targetAssignee, setTargetAssignee] = useState("");
  const [targetPriority, setTargetPriority] = useState("All");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAnalyze = async () => {
    if (!documentContent.trim() && !fileData) {
      setError("Please provide meeting content to analyze.");
      return;
    }
    setError(null);
    setIsAnalyzing(true);
    setResult(null);
    try {
      const input = fileData 
        ? { type: 'file' as const, mimeType: fileData.mimeType, data: fileData.data, textPreview: documentContent } 
        : { type: 'text' as const, text: documentContent };
      const data = await analyzeMeeting(input);
      setResult(data);
    } catch (err: any) {
      setError(err.message || "An error occurred during analysis.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    
    // Determine file type
    const isTextBased = file.name.endsWith('.txt') || file.name.endsWith('.md') || file.name.endsWith('.csv') || file.name.endsWith('.rtf');
    const isPdf = file.name.endsWith('.pdf');
    const isDocx = file.name.endsWith('.docx') || file.name.endsWith('.doc');

    const reader = new FileReader();
    
    if (isTextBased) {
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setDocumentContent(text);
        setFileData(null);
        setInputMode("file");
      };
      reader.onerror = () => {
        setError("Failed to read the text file.");
      };
      reader.readAsText(file);
    } else {
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        // extract base64 part
        const base64Data = dataUrl.split(',')[1];
        let mimeType = file.type;
        if (!mimeType) {
          if (isPdf) mimeType = 'application/pdf';
          else if (isDocx) mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          else mimeType = 'application/octet-stream';
        }
        
        setFileData({ mimeType, data: base64Data, extension: file.name.split('.').pop() });
        setDocumentContent(`[Binary File Uploaded: ${file.name}]\n\nReady for analysis.`);
        setInputMode("file");
      };
      reader.onerror = () => {
        setError("Failed to read the file.");
      };
      reader.readAsDataURL(file);
    }
  };

  const resetAll = () => {
    setResult(null);
    setDocumentContent("");
    setFileData(null);
    setInputMode(null);
    setFileName(null);
    setError(null);
    setTargetAssignee("");
    setTargetPriority("All");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const syncToGoogleTasks = (task: any) => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId || clientId === "YOUR_GOOGLE_CLIENT_ID") {
      alert("Please configure VITE_GOOGLE_CLIENT_ID in the AI Studio Settings.");
      return;
    }
    
    try {
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/tasks',
        callback: async (response: any) => {
            if (response.error !== undefined) {
               alert("Authentication failed: " + response.error);
               return;
            }
            const token = response.access_token;
            try {
              const req = await fetch('https://tasks.googleapis.com/tasks/v1/lists/@default/tasks', {
                  method: 'POST',
                  headers: {
                      'Authorization': `Bearer ${token}`,
                      'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                      title: task.title,
                      notes: task.notes,
                      due: task.due_date ? new Date(task.due_date).toISOString() : undefined
                  })
              });
              if (req.ok) {
                  alert('Task successfully synchronized to Google Tasks!');
              } else {
                  alert('Integration Error: Could not verify connection to Google Tasks.');
              }
            } catch (err: any) {
              alert("Network error while syncing: " + err.message);
            }
        }
      });
      tokenClient.requestAccessToken({ prompt: '' });
    } catch (err: any) {
      alert("Failed to initialize Google Identity Services. Ensure you are allowing scripts.");
    }
  };

  const renderHomeSelection = () => (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }} 
      animate={{ opacity: 1, scale: 1 }} 
      className="col-span-1 lg:col-span-12 flex flex-col items-center justify-center min-h-[60vh]"
    >
      <div className="max-w-2xl w-full text-center space-y-8">
        <div className="space-y-4">
          <div className="mx-auto w-20 h-20 bg-slate-900 text-white rounded-2xl flex items-center justify-center transform rotate-3 shadow-xl">
             <Bot className="h-10 w-10 transform -rotate-3" />
          </div>
          <h2 className="text-3xl font-black uppercase tracking-tight text-slate-900">Start Analysis</h2>
          <p className="text-slate-500 font-medium">Select how you want to provide your meeting data.</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-6 w-full px-4">
          {/* File Upload Option */}
          <motion.button 
            whileHover={{ y: -4, scale: 1.01, boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)' }}
            whileTap={{ scale: 0.98 }}
            onClick={() => fileInputRef.current?.click()}
            className="group relative bg-white border-2 border-slate-200 hover:border-blue-600 p-8 flex flex-col items-center justify-center gap-4 transition-all hover:shadow-lg focus:outline-none text-left"
          >
            <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
               <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-1 uppercase tracking-wider">Select</span>
            </div>
            <div className="w-16 h-16 bg-slate-50 group-hover:bg-blue-50 rounded-full flex items-center justify-center transition-colors">
              <UploadCloud className="h-8 w-8 text-slate-400 group-hover:text-blue-600 transition-colors" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-black uppercase tracking-tight mb-2">Upload File</h3>
              <p className="text-xs text-slate-500 font-medium">Supports .txt, .md, .csv, .pdf, .docx</p>
            </div>
          </motion.button>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            className="hidden" 
            accept=".txt,.md,.csv,.rtf,.pdf,.docx,.doc" 
          />

          {/* Paste Text Option */}
          <motion.button 
            whileHover={{ y: -4, scale: 1.01, boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)' }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setInputMode("text")}
            className="group relative bg-white border-2 border-slate-200 hover:border-slate-900 p-8 flex flex-col items-center justify-center gap-4 transition-all hover:shadow-lg focus:outline-none text-left"
          >
            <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
               <span className="bg-slate-900 text-white text-[10px] font-bold px-2 py-1 uppercase tracking-wider">Select</span>
            </div>
            <div className="w-16 h-16 bg-slate-50 group-hover:bg-slate-100 rounded-full flex items-center justify-center transition-colors">
              <TypeIcon className="h-8 w-8 text-slate-400 group-hover:text-slate-900 transition-colors" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-black uppercase tracking-tight mb-2">Paste Transcript</h3>
              <p className="text-xs text-slate-500 font-medium">Directly paste raw text notes</p>
            </div>
          </motion.button>
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="relative min-h-screen font-sans text-slate-900 p-4 sm:p-8 flex flex-col selection:bg-slate-300 bg-slate-50 overflow-x-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9IiNjYmQ1ZTEiIGZpbGwtb3BhY2l0eT0iMC42Ii8+PC9zdmc+')] [mask-image:linear-gradient(to_bottom_right,white,transparent,transparent)] pointer-events-none" />
      
      <div className="relative z-10 flex flex-col flex-grow">
      {/* Header Section */}
      <motion.header 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="flex justify-between items-end border-b-2 border-slate-900 pb-4 mb-6 sticky top-0 z-10 bg-slate-50/90 backdrop-blur-sm"
      >
        <div>
          <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Automation Architect / v2.4</div>
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight cursor-pointer" onClick={resetAll}>Meeting Intelligence Suite</h1>
        </div>
        <div className="hidden sm:flex gap-4">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Automation Status</span>
            <span className="flex items-center text-emerald-600 font-bold text-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></span> GWS ACTIVE
            </span>
          </div>
        </div>
      </motion.header>

      {/* Main Content Grid */}
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-grow">
        
        {!inputMode && !result && !isAnalyzing ? (
          renderHomeSelection()
        ) : (
          <>
            {/* Phase 1: Analytical Intelligence Panel (Or Phase 0 Input) */}
            <section className={`lg:col-span-3 ${result ? 'border-r border-slate-200 pr-0 lg:pr-6' : 'lg:col-span-12'}`}>
              {!result && !isAnalyzing && (
                <div className="mb-6 h-full flex flex-col">
                  <div className="flex justify-between items-center mb-3">
                     <h3 className="text-xs font-black uppercase bg-slate-900 text-white px-2 py-1 inline-block self-start">Phase 0: Input</h3>
                     <button onClick={resetAll} className="text-[9px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-900 underline">Change Input Method</button>
                  </div>
                  <div className="bg-white border border-slate-200 shadow-sm flex flex-col min-h-[400px] flex-grow">
                    {inputMode === 'file' && fileName ? (
                      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                        <div className="flex items-center gap-2">
                           <FileType className="h-5 w-5 text-blue-600" />
                           <span className="text-sm font-bold text-slate-700">{fileName}</span>
                        </div>
                        <button onClick={() => fileInputRef.current?.click()} className="text-[10px] font-bold uppercase text-slate-500 hover:text-slate-900">Replace</button>
                      </div>
                    ) : null}
                    <Textarea 
                      value={documentContent}
                      onChange={(e) => setDocumentContent(e.target.value)}
                      disabled={!!fileData}
                      placeholder={inputMode === 'text' ? "Paste your meeting notes, transcript, or document here..." : "File content will appear here..."}
                      className="flex-1 w-full border-0 focus-visible:ring-0 resize-none p-4 text-[13px] leading-relaxed text-slate-700 bg-transparent rounded-none disabled:opacity-50"
                    />
                    <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">
                        {fileData ? `${(fileData.data.length * 0.75 / 1024).toFixed(1)} KB` : `${documentContent.length} chars`}
                      </div>
                      <motion.button 
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleAnalyze} 
                        disabled={isAnalyzing || (!documentContent.trim() && !fileData)}
                        className="bg-slate-900 text-white text-[10px] disabled:opacity-50 font-bold px-4 py-2 hover:bg-slate-700 uppercase tracking-widest transition-colors"
                      >
                        {isAnalyzing ? "Analyzing..." : "Extract Actions"}
                      </motion.button>
                    </div>
                  </div>
                  {error && (
                    <div className="mt-4 p-3 bg-rose-50 text-rose-600 border-l-4 border-rose-500 text-xs font-bold shadow-sm flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      {error}
                    </div>
                  )}
                </div>
              )}
              {isAnalyzing && (
                  <div className="mb-6 h-full flex flex-col">
                    <h3 className="text-xs font-black uppercase mb-3 bg-slate-900 text-white px-2 py-1 inline-block self-start">Processing</h3>
                    <div className="bg-white border border-slate-200 flex-grow p-4 space-y-4 shadow-sm flex flex-col items-center justify-center min-h-[400px]">
                        <Loader2 className="h-8 w-8 animate-spin text-slate-900" />
                        <div className="text-xs font-bold uppercase tracking-widest text-slate-400">Analyzing Content...</div>
                    </div>
                  </div>
              )}
              {result && !isAnalyzing && (
                <AnimatePresence>
                  <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="mb-6 space-y-6">
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-xs font-black uppercase bg-slate-900 text-white px-2 py-1 inline-block">Phase 1: Analysis</h3>
                        <button onClick={resetAll} className="text-[9px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-900 underline">Reset All</button>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="bg-white border border-slate-200 p-4 shadow-sm">
                          <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Meeting Vibe</div>
                          <div className="text-lg font-bold text-blue-600">{result.meta.vibe}</div>
                        </div>
                        <div className="bg-white border border-slate-200 p-4 shadow-sm">
                          <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Executive Summary</div>
                          <p className="text-[11px] leading-relaxed text-slate-600">
                            {result.meta.executive_summary}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">
                        {fileName ? `Source: ${fileName}` : 'Original Source'}
                      </div>
                      <div className="bg-white border border-slate-200 p-3 shadow-sm h-32 overflow-y-auto">
                        <p className="text-[10px] text-slate-500 font-mono whitespace-pre-wrap">{documentContent}</p>
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              )}
            </section>

            {/* Phase 2: Tasks Grid */}
            {result && !isAnalyzing && (
              <section className="lg:col-span-5 flex flex-col lg:h-[600px] xl:h-[640px]">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xs font-black uppercase bg-slate-900 text-white px-2 py-1 inline-block self-start">Phase 2: Action Items</h3>
                </div>
                <div className="mb-3 flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input 
                      type="text"
                      value={targetAssignee}
                      onChange={(e) => setTargetAssignee(e.target.value)}
                      placeholder="Filter by Assignee e.g. Sarah Chen or 'me'"
                      className="w-full pl-9 h-9 text-[11px] border border-slate-200 hover:border-slate-300 focus:border-slate-400 focus:ring-0 transition-colors outline-none font-medium placeholder:text-slate-400 shadow-sm"
                    />
                  </div>
                  <div className="sm:w-40 relative">
                    <select
                      value={targetPriority}
                      onChange={(e) => setTargetPriority(e.target.value)}
                      className="w-full h-9 text-[11px] border border-slate-200 hover:border-slate-300 focus:border-slate-400 focus:ring-0 transition-colors outline-none font-medium text-slate-700 shadow-sm px-3 appearance-none bg-white"
                    >
                      <option value="All">All Priorities</option>
                      <option value="1">Priority 1 (High)</option>
                      <option value="2">Priority 2 (Med)</option>
                      <option value="3">Priority 3 (Low)</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                      <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                  </div>
                </div>
                <ScrollArea className="flex-grow pr-3">
                  <div className="flex flex-col gap-3 pb-4">
                    {(() => {
                      const filteredTasks = result.tasks.filter((task: any) => {
                        let assigneeMatch = true;
                        if (targetAssignee.trim()) {
                          const search = targetAssignee.toLowerCase().trim();
                          if (search === 'me' && task.assignee.toLowerCase() === 'user') {
                            assigneeMatch = true;
                          } else {
                            assigneeMatch = task.assignee.toLowerCase().includes(search);
                          }
                        }
                        
                        let priorityMatch = true;
                        if (targetPriority !== "All") {
                          priorityMatch = task.priority.toString() === targetPriority;
                        }

                        return assigneeMatch && priorityMatch;
                      });

                      if (filteredTasks.length === 0) {
                        return (
                          <div className="p-8 text-center text-slate-500 text-sm border-2 border-dashed border-slate-200">
                            No tasks found for "{targetAssignee}"
                          </div>
                        );
                      }

                      return filteredTasks.map((task: any, idx: number) => {
                        let prioColor = "slate-500";
                        let badgeColor = "bg-slate-100 text-slate-600";
                        if (task.priority === 1) { prioColor = "rose-500"; badgeColor = "bg-rose-100 text-rose-600"; }
                        if (task.priority === 2) { prioColor = "amber-500"; badgeColor = "bg-amber-100 text-amber-600"; }
                        if (task.priority === 3) { prioColor = "blue-500"; badgeColor = "bg-blue-100 text-blue-600"; }
                        
                        return (
                          <motion.div 
                            key={idx}
                            layout
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            whileHover={{ y: -4, scale: 1.01, zIndex: 10, boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            transition={{ delay: idx * 0.05, duration: 0.3 }}
                            className={`bg-white border-y border-r border-slate-200 p-4 shadow-sm relative transition-shadow`} style={{ borderLeftWidth: '4px', borderLeftColor: `var(--color-${prioColor})` }}
                          >
                            <div className="absolute top-4 right-4 flex items-center">
                              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${badgeColor}`}>
                                PRIORITY {task.priority}
                              </span>
                            </div>
                            <h4 className="text-sm font-bold leading-none mb-1 pr-16">{task.title}</h4>
                            <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">{task.notes}</p>
                            <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-50">
                              <div className="flex gap-4">
                                <div className="text-[10px]"><span className="text-slate-400 uppercase font-bold">Owner:</span> <span className="text-slate-900">{task.assignee}</span></div>
                                {task.due_date && <div className="text-[10px]"><span className="text-slate-400 uppercase font-bold">Due:</span> <span className="text-slate-900">{task.due_date}</span></div>}
                              </div>
                              <motion.button 
                                onClick={() => syncToGoogleTasks(task)}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="bg-slate-900 text-white text-[9px] px-2 py-1 hover:bg-slate-700 font-bold uppercase tracking-wider transition-colors shrink-0"
                              >
                                SYNC TO TASKS
                              </motion.button>
                            </div>
                          </motion.div>
                        );
                      });
                    })()}
                  </div>
                </ScrollArea>
              </section>
            )}

            {/* Phase 3: Communication Panel */}
            {result && !isAnalyzing && (
              <section className="lg:col-span-4 lg:border-l lg:border-slate-200 lg:pl-6 flex flex-col lg:h-[600px] xl:h-[640px] mt-6 lg:mt-0">
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="h-full flex flex-col">
                  <h3 className="text-xs font-black uppercase mb-3 bg-slate-900 text-white px-2 py-1 inline-block self-start">Phase 3: Follow-Up</h3>
                  <div className="bg-white border border-slate-200 flex flex-col flex-grow shadow-sm min-h-[400px]">
                    <div className="p-3 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Subject</div>
                        <div className="text-[11px] font-bold text-slate-900">{result.follow_up_email.subject}</div>
                      </div>
                      <button 
                        className="bg-slate-200 text-slate-700 text-[9px] font-bold px-2 py-1 hover:bg-slate-300 uppercase tracking-widest transition-colors flex shrink-0 ml-4 rounded-sm"
                        onClick={() => navigator.clipboard.writeText(`Subject: ${result.follow_up_email.subject}\n\n${result.follow_up_email.body}`)}
                      >
                        Copy
                      </button>
                    </div>
                    <div className="p-3 flex-grow overflow-hidden flex flex-col">
                      <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Body Draft</div>
                      <ScrollArea className="flex-grow">
                        <div className="text-[11px] text-slate-700 font-mono space-y-2 leading-relaxed whitespace-pre-wrap pr-3">
                          {result.follow_up_email.body}
                        </div>
                      </ScrollArea>
                    </div>
                    <motion.div 
                      onClick={() => window.location.href = `mailto:?subject=${encodeURIComponent(result.follow_up_email.subject)}&body=${encodeURIComponent(result.follow_up_email.body)}`}
                      whileHover={{ backgroundColor: '#f1f5f9' }}
                      className="p-3 bg-slate-50 border-t border-slate-200 transition-colors cursor-pointer group flex items-center justify-center"
                    >
                       <Mail className="h-4 w-4 mr-2 text-blue-600" />
                       <span className="text-blue-600 font-bold text-xs uppercase tracking-widest group-hover:text-blue-700 transition-colors">Draft Email</span>
                    </motion.div>
                  </div>
                </motion.div>
              </section>
            )}
          </>
        )}
      </main>

      <footer className="mt-8 flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase border-t-2 border-slate-900 pt-4">
        <div className="flex gap-6">
          <span>Session ID: PM-{new Date().getTime().toString().slice(-4)}-X</span>
          <span>Today: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-slate-900">{isAnalyzing ? 'Processing...' : (result ? 'Valid JSON Output Ready' : 'Awaiting Input')}</span>
          <div className={`w-3 h-3 ${isAnalyzing ? 'bg-amber-500 animate-pulse' : (result ? 'bg-emerald-500' : 'bg-slate-300')} rounded-sm`}></div>
        </div>
      </footer>
      </div>
    </div>
  );
}

