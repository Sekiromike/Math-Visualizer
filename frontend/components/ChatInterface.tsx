"use client";
import React, { useState, useEffect, useRef } from 'react';
import { Send, RefreshCw, AlertCircle, Settings, PlayCircle } from 'lucide-react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface Animation {
    id: string;
    title: string;
    status: 'queued' | 'rendering' | 'completed' | 'failed';
    video_url?: string;
    error?: string;
    scene_spec?: string;
    duration?: number;
}

interface Message {
    role: 'user' | 'assistant';
    content: string;
    animations?: Animation[];
}

const API_Base = "http://localhost:8000";

export default function ChatInterface() {
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: "Hello! I'm your Math Tutor. Ask me to explain a concept!" }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [quality, setQuality] = useState<'low' | 'high'>('low');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Polling for animation status
    useEffect(() => {
        const interval = setInterval(async () => {
            const activeAnimations: Animation[] = messages.flatMap(m => m.animations || [])
                .filter(a => a.status === 'queued' || a.status === 'rendering');

            if (activeAnimations.length === 0) return;

            const newMessages = [...messages];
            let changed = false;

            for (const anim of activeAnimations) {
                try {
                    const res = await axios.get(`${API_Base}/render/status/${anim.id}`);
                    if (res.data.status !== anim.status) {
                        // Update status
                        for (const msg of newMessages) {
                            if (!msg.animations) continue;
                            const target = msg.animations.find(a => a.id === anim.id);
                            if (target) {
                                target.status = res.data.status;
                                if (res.data.video_url) {
                                    let url = res.data.video_url;
                                    if (url && url.startsWith('/')) {
                                        url = `${API_Base}${url}`;
                                    }
                                    target.video_url = url;
                                }
                                target.error = res.data.error;
                                changed = true;
                            }
                        }
                    }
                } catch (e) {
                    console.error("Poll error", e);
                }
            }

            if (changed) {
                setMessages(newMessages);
            }

        }, 2000);

        return () => clearInterval(interval);
    }, [messages]);

    const sendMessage = async () => {
        if (!input.trim() || loading) return;

        const userMsg: Message = { role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const history = messages.map(m => ({ role: m.role, content: m.content }));

            const res = await axios.post(`${API_Base}/chat`, {
                message: userMsg.content,
                conversation_history: history,
                quality: quality
            });

            const data = res.data;

            const aiMsg: Message = {
                role: 'assistant',
                content: data.reply,
                animations: data.animations || []
            };

            setMessages(prev => [...prev, aiMsg]);

        } catch (e) {
            console.error(e);
            setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I encountered an error connecting to the tutor backend." }]);
        } finally {
            setLoading(false);
        }
    };

    const regenerateAnimation = async (anim: Animation) => {
        if (!anim.scene_spec) return;

        try {
            // Set status to queued in UI
            setMessages(prev => prev.map(msg => {
                if (!msg.animations) return msg;
                return {
                    ...msg,
                    animations: msg.animations.map(a => {
                        if (a.id === anim.id) {
                            return { ...a, status: 'queued', error: undefined };
                        }
                        return a;
                    })
                };
            }));

            // Call Render API
            const res = await axios.post(`${API_Base}/render`, {
                scene_spec: anim.scene_spec,
                duration: anim.duration || 15,
                quality: quality
            });

            // Update ID to new job ID (so we poll the new job)
            const newJobId = res.data.job_id;

            setMessages(prev => prev.map(msg => {
                if (!msg.animations) return msg;
                return {
                    ...msg,
                    animations: msg.animations.map(a => {
                        if (a.id === anim.id) {
                            return { ...a, id: newJobId };
                        }
                        return a;
                    })
                };
            }));

        } catch (e) {
            console.error("Regenerate failed", e);
            // Restore status to failed or whatever
        }
    };

    return (
        <div className="flex flex-col w-full h-full bg-gray-900 rounded-xl shadow-2xl overflow-hidden border border-gray-800 font-sans">
            {/* Header */}
            <div className="flex justify-between items-center p-4 bg-gray-800 border-b border-gray-700">
                <div className="flex items-center gap-2 text-white font-bold">
                    <span className="text-blue-500">AI</span> Math Tutor
                </div>
                <div className="flex items-center gap-2">
                    <span className={`text-xs ${quality === 'low' ? 'text-green-400' : 'text-gray-500'}`}>Draft</span>
                    <button
                        onClick={() => setQuality(q => q === 'low' ? 'high' : 'low')}
                        className={`w-12 h-6 rounded-full p-1 transition-colors ${quality === 'high' ? 'bg-blue-600' : 'bg-gray-600'}`}
                    >
                        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${quality === 'high' ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                    <span className={`text-xs ${quality === 'high' ? 'text-blue-400' : 'text-gray-500'}`}>HQ</span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`p-5 rounded-2xl max-w-[90%] lg:max-w-[75%] shadow-md ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-gray-800 text-gray-100 border border-gray-700 rounded-tl-none'}`}>
                            <div className="markdown-body prose prose-invert max-w-none text-sm leading-relaxed">
                                <ReactMarkdown
                                    remarkPlugins={[remarkMath]}
                                    rehypePlugins={[rehypeKatex]}
                                    components={{
                                        p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />
                                    }}
                                >
                                    {msg.content}
                                </ReactMarkdown>
                            </div>

                            {msg.animations && msg.animations.map(anim => (
                                <div key={anim.id} className="mt-4 p-4 bg-black/40 rounded-xl border border-gray-700/50 backdrop-blur-sm">
                                    <div className="flex justify-between items-center mb-3">
                                        <div className="flex items-center gap-2">
                                            <PlayCircle size={14} className="text-blue-400" />
                                            <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">{anim.title || "Visualization"}</span>
                                        </div>
                                        <span className="text-[10px] uppercase font-mono text-gray-500 px-2 py-1 bg-gray-800 rounded">{anim.status}</span>
                                    </div>

                                    {anim.status === 'completed' && anim.video_url ? (
                                        <div className="space-y-2">
                                            <video
                                                src={anim.video_url}
                                                controls
                                                loop
                                                autoPlay
                                                className="w-full rounded-lg shadow-2xl border border-gray-700"
                                            />
                                            <div className="flex justify-end">
                                                <button
                                                    onClick={() => regenerateAnimation(anim)}
                                                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
                                                >
                                                    <RefreshCw size={12} /> Regenerate
                                                </button>
                                            </div>
                                        </div>
                                    ) : anim.status === 'failed' ? (
                                        <div className="space-y-2">
                                            <div className="flex items-start gap-2 text-red-400 p-3 bg-red-950/30 rounded-lg border border-red-900/50">
                                                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                                                <div className="space-y-1">
                                                    <span className="text-xs font-bold block">Rendering failed</span>
                                                    <span className="text-xs opacity-75 font-mono break-all">{anim.error}</span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => regenerateAnimation(anim)}
                                                className="flex items-center gap-2 text-xs bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded text-white transition-colors w-full justify-center"
                                            >
                                                <RefreshCw size={12} /> Retry Render
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center p-8 bg-gray-800/50 rounded-lg border border-gray-700/50 relative overflow-hidden group">
                                            <div className="absolute inset-0 bg-blue-500/5 animate-pulse" />
                                            <RefreshCw className="animate-spin mb-3 text-blue-500" size={24} />
                                            <span className="text-xs text-blue-300 font-medium">Generating Animation...</span>
                                            <span className="text-[10px] text-gray-500 mt-1">This may take up to 30s</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="flex justify-start animate-fade-in">
                        <div className="p-4 bg-gray-800 rounded-2xl rounded-tl-none border border-gray-700 shadow-sm">
                            <div className="flex gap-1.5">
                                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="p-4 bg-gray-800 border-t border-gray-700 flex gap-3">
                <input
                    className="flex-1 bg-gray-900 text-white rounded-xl px-5 py-3 outline-none focus:ring-2 focus:ring-blue-600 border border-gray-700 placeholder-gray-500 transition-all font-medium"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Ask a math question..."
                />
                <button
                    onClick={sendMessage}
                    disabled={loading}
                    className="p-3 bg-blue-600 rounded-xl hover:bg-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-900/20 active:scale-95"
                >
                    <Send size={24} />
                </button>
            </div>
        </div>
    );
}
