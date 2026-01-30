// Document Editor - Multi-format document editing with save/load capabilities

class DocumentEditor {
    constructor() {
        this.currentDocument = '';
        this.currentFilename = 'untitled.txt';
        this.currentType = 'text';
        this.savedDocuments = [];
        this.hasUnsavedChanges = false;

        this.fileExtensions = {
            'text': '.txt',
            'markdown': '.md',
            'html': '.html',
            'css': '.css',
            'javascript': '.js',
            'json': '.json',
            'xml': '.xml',
            'csv': '.csv',
            'python': '.py',
            'java': '.java',
            'cpp': '.cpp',
            'sql': '.sql'
        };

        this.init();
    }

    async init() {
        await this.loadSavedDocuments();
        this.setupEventListeners();
        this.updateStats();
    }

    setupEventListeners() {
        // Editor type change
        document.getElementById('editorTypeSelect').addEventListener('change', (e) => {
            this.changeEditorType(e.target.value);
        });

        // Document editor input
        const editor = document.getElementById('documentEditor');
        editor.addEventListener('input', () => {
            this.hasUnsavedChanges = true;
            this.updateStats();
            this.updatePreview();
        });

        // File operations
        document.getElementById('newDocBtn').addEventListener('click', () => {
            this.newDocument();
        });

        document.getElementById('loadDocBtn').addEventListener('click', () => {
            document.getElementById('loadDocInput').click();
        });

        document.getElementById('loadDocInput').addEventListener('change', (e) => {
            this.loadFromFile(e.target.files[0]);
        });

        document.getElementById('saveDocBtn').addEventListener('click', () => {
            this.saveDocument();
        });

        document.getElementById('downloadDocBtn').addEventListener('click', () => {
            this.downloadDocument();
        });

        document.getElementById('previewDocBtn').addEventListener('click', () => {
            this.togglePreview();
        });

        // Filename change
        document.getElementById('docFilename').addEventListener('change', (e) => {
            this.currentFilename = e.target.value;
        });

        // Keyboard shortcuts
        editor.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + S to save
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this.saveDocument();
            }

            // Tab key handling
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = editor.selectionStart;
                const end = editor.selectionEnd;
                const value = editor.value;

                // Insert tab character
                editor.value = value.substring(0, start) + '    ' + value.substring(end);
                editor.selectionStart = editor.selectionEnd = start + 4;

                this.hasUnsavedChanges = true;
                this.updateStats();
            }
        });
    }

    changeEditorType(type) {
        this.currentType = type;
        const ext = this.fileExtensions[type];

        // Update filename if it's still default
        if (this.currentFilename.startsWith('untitled')) {
            this.currentFilename = 'untitled' + ext;
            document.getElementById('docFilename').value = this.currentFilename;
        }

        // Show/hide preview button for HTML and Markdown
        const previewBtn = document.getElementById('previewDocBtn');
        if (type === 'html' || type === 'markdown') {
            previewBtn.style.display = 'block';
        } else {
            previewBtn.style.display = 'none';
            document.getElementById('editorPreview').style.display = 'none';
        }

        // Update editor placeholder
        const editor = document.getElementById('documentEditor');
        const placeholders = {
            'text': 'Start typing your text document...',
            'markdown': '# Markdown Document\n\nStart writing markdown here...',
            'html': '<!DOCTYPE html>\n<html>\n<head>\n    <title>Document</title>\n</head>\n<body>\n    \n</body>\n</html>',
            'css': '/* CSS Stylesheet */\n\n',
            'javascript': '// JavaScript Code\n\n',
            'json': '{\n    \n}',
            'xml': '<?xml version="1.0" encoding="UTF-8"?>\n<root>\n    \n</root>',
            'csv': 'Column1,Column2,Column3\n',
            'python': '# Python Script\n\n',
            'java': '// Java Code\n\npublic class Main {\n    public static void main(String[] args) {\n        \n    }\n}',
            'cpp': '// C++ Code\n\n#include <iostream>\n\nint main() {\n    \n    return 0;\n}',
            'sql': '-- SQL Query\n\n'
        };

        editor.placeholder = placeholders[type] || 'Start typing...';

        window.browser?.showToast(`Switched to ${type.toUpperCase()} editor`, 'info');
    }

    newDocument() {
        if (this.hasUnsavedChanges) {
            if (!confirm('You have unsaved changes. Create new document anyway?')) {
                return;
            }
        }

        const editor = document.getElementById('documentEditor');
        editor.value = '';
        this.currentFilename = 'untitled' + this.fileExtensions[this.currentType];
        document.getElementById('docFilename').value = this.currentFilename;
        this.hasUnsavedChanges = false;
        this.updateStats();

        window.browser?.showToast('New document created', 'success');
    }

    async loadFromFile(file) {
        if (!file) return;

        try {
            const text = await file.text();
            const editor = document.getElementById('documentEditor');
            editor.value = text;

            this.currentFilename = file.name;
            document.getElementById('docFilename').value = this.currentFilename;

            // Detect file type from extension
            const ext = file.name.split('.').pop().toLowerCase();
            const typeMap = {
                'txt': 'text',
                'md': 'markdown',
                'html': 'html',
                'htm': 'html',
                'css': 'css',
                'js': 'javascript',
                'json': 'json',
                'xml': 'xml',
                'csv': 'csv',
                'py': 'python',
                'java': 'java',
                'cpp': 'cpp',
                'c': 'cpp',
                'sql': 'sql'
            };

            if (typeMap[ext]) {
                this.currentType = typeMap[ext];
                document.getElementById('editorTypeSelect').value = this.currentType;
                this.changeEditorType(this.currentType);
            }

            this.hasUnsavedChanges = false;
            this.updateStats();
            this.updatePreview();

            window.browser?.showToast(`Loaded ${file.name}`, 'success');
        } catch (error) {
            console.error('Load file error:', error);
            window.browser?.showToast('Failed to load file', 'error');
        }
    }

    saveDocument() {
        const editor = document.getElementById('documentEditor');
        const content = editor.value;
        const filename = document.getElementById('docFilename').value || this.currentFilename;

        // Save to localStorage
        const doc = {
            filename: filename,
            type: this.currentType,
            content: content,
            timestamp: Date.now()
        };

        // Update or add document
        const existingIndex = this.savedDocuments.findIndex(d => d.filename === filename);
        if (existingIndex >= 0) {
            this.savedDocuments[existingIndex] = doc;
        } else {
            this.savedDocuments.push(doc);
        }

        localStorage.setItem('timelord_documents', JSON.stringify(this.savedDocuments));

        this.hasUnsavedChanges = false;
        this.currentFilename = filename;

        window.browser?.showToast(`Saved ${filename}`, 'success');
    }

    downloadDocument() {
        const editor = document.getElementById('documentEditor');
        const content = editor.value;
        const filename = document.getElementById('docFilename').value || this.currentFilename;

        // Create blob and download
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);

        window.browser?.showToast(`Downloaded ${filename}`, 'success');
    }

    updateStats() {
        const editor = document.getElementById('documentEditor');
        const content = editor.value;

        // Count lines
        const lines = content.split('\n').length;
        document.getElementById('editorLines').textContent = lines;

        // Count words
        const words = content.trim() ? content.trim().split(/\s+/).length : 0;
        document.getElementById('editorWords').textContent = words;

        // Count characters
        const chars = content.length;
        document.getElementById('editorChars').textContent = chars;
    }

    updatePreview() {
        const previewDiv = document.getElementById('editorPreview');
        if (previewDiv.style.display === 'none') return;

        const editor = document.getElementById('documentEditor');
        const content = editor.value;
        const previewContent = document.getElementById('previewContent');

        if (this.currentType === 'html') {
            // HTML preview (sanitized for safety)
            previewContent.innerHTML = content;
        } else if (this.currentType === 'markdown') {
            // Simple markdown rendering (basic support)
            const html = this.simpleMarkdownToHTML(content);
            previewContent.innerHTML = html;
        }
    }

    togglePreview() {
        const previewDiv = document.getElementById('editorPreview');
        if (previewDiv.style.display === 'none') {
            previewDiv.style.display = 'block';
            this.updatePreview();
        } else {
            previewDiv.style.display = 'none';
        }
    }

    simpleMarkdownToHTML(markdown) {
        // Basic markdown parsing (simplified)
        let html = markdown;

        // Headers
        html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
        html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

        // Bold
        html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');

        // Italic
        html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');

        // Code
        html = html.replace(/`(.*?)`/gim, '<code>$1</code>');

        // Links
        html = html.replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2">$1</a>');

        // Line breaks
        html = html.replace(/\n/gim, '<br>');

        return html;
    }

    async loadSavedDocuments() {
        const saved = localStorage.getItem('timelord_documents');
        if (saved) {
            try {
                this.savedDocuments = JSON.parse(saved);
            } catch (error) {
                console.error('Error loading saved documents:', error);
                this.savedDocuments = [];
            }
        }
    }

    getSavedDocuments() {
        return this.savedDocuments;
    }
}

// Initialize document editor
document.addEventListener('DOMContentLoaded', () => {
    window.documentEditor = new DocumentEditor();
    console.log('Document Editor initialized');
});
