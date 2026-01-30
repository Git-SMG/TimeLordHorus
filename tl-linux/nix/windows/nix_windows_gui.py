#!/usr/bin/env python3
"""
NIX Control Center - Windows Edition
Enhanced GUI with Windows-specific features
"""

import tkinter as tk
from tkinter import ttk, messagebox, filedialog
import os
import sys
from pathlib import Path
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Import Windows paths if available
try:
    from windows.paths import get_wallet_dir, get_app_data_dir, ensure_directories, is_windows
except ImportError:
    def get_wallet_dir():
        return os.path.expanduser("~/.nix/wallet")
    def get_app_data_dir():
        return os.path.expanduser("~/.nix")
    def ensure_directories():
        os.makedirs(get_wallet_dir(), exist_ok=True)
    def is_windows():
        return sys.platform == 'win32'

from core.models import Individual, Household, DocumentType, VerificationStatus
from core.sec_file import SECFile
from core.verification import VerificationEngine, VerificationLevel


class NIXControlCenterWindows:
    """
    NIX Control Center - Windows Edition
    Enhanced with Windows-specific features
    """

    def __init__(self):
        self.window = tk.Tk()
        self.window.title("NIX Control Center")
        self.window.geometry("1200x800")

        # Set Windows icon if available
        if is_windows():
            try:
                icon_path = os.path.join(os.path.dirname(__file__), 'nix_icon.ico')
                if os.path.exists(icon_path):
                    self.window.iconbitmap(icon_path)
            except:
                pass

        # Ensure directories exist
        ensure_directories()

        # Data
        self.wallet_path = get_wallet_dir()
        self.documents = []
        self.verification_engine = VerificationEngine()

        # Setup UI
        self.setup_ui()
        self.load_documents()

        # Windows-specific features
        if is_windows():
            self.setup_windows_features()

    def setup_windows_features(self):
        """Setup Windows-specific features"""
        # Set window icon in taskbar
        try:
            import ctypes
            myappid = 'timelord.nix.controlcenter.1.0'
            ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(myappid)
        except:
            pass

    def setup_ui(self):
        """Setup the user interface"""

        # Menu Bar
        menubar = tk.Menu(self.window)
        self.window.config(menu=menubar)

        # File menu
        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="File", menu=file_menu)
        file_menu.add_command(label="Import Document...", command=self.import_document, accelerator="Ctrl+I")
        file_menu.add_command(label="Export Document...", command=self.export_document, accelerator="Ctrl+E")
        file_menu.add_separator()
        file_menu.add_command(label="Preferences...", command=self.show_preferences, accelerator="Ctrl+,")
        file_menu.add_separator()
        file_menu.add_command(label="Exit", command=self.on_closing, accelerator="Alt+F4")

        # Tools menu
        tools_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="Tools", menu=tools_menu)
        tools_menu.add_command(label="Verify Document...", command=self.verify_selected, accelerator="Ctrl+V")
        tools_menu.add_command(label="View Document Info", command=self.view_document_info, accelerator="Ctrl+D")
        tools_menu.add_separator()
        tools_menu.add_command(label="Open Wallet Folder", command=self.open_wallet_folder)
        tools_menu.add_command(label="Backup Wallet...", command=self.backup_wallet)

        # Help menu
        help_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="Help", menu=help_menu)
        help_menu.add_command(label="Documentation", command=self.show_documentation, accelerator="F1")
        help_menu.add_command(label="Check for Updates...", command=self.check_updates)
        help_menu.add_separator()
        help_menu.add_command(label="About NIX", command=self.show_about)

        # Keyboard shortcuts
        self.window.bind('<Control-i>', lambda e: self.import_document())
        self.window.bind('<Control-e>', lambda e: self.export_document())
        self.window.bind('<Control-v>', lambda e: self.verify_selected())
        self.window.bind('<Control-d>', lambda e: self.view_document_info())
        self.window.bind('<F1>', lambda e: self.show_documentation())
        self.window.bind('<F5>', lambda e: self.load_documents())

        # Main container
        main_frame = ttk.Frame(self.window, padding="10")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))

        # Configure grid weights
        self.window.columnconfigure(0, weight=1)
        self.window.rowconfigure(0, weight=1)
        main_frame.columnconfigure(0, weight=1)
        main_frame.rowconfigure(1, weight=1)

        # Title bar
        title_frame = ttk.Frame(main_frame)
        title_frame.grid(row=0, column=0, sticky=(tk.W, tk.E), pady=(0, 10))

        title_label = ttk.Label(
            title_frame,
            text="NIX Control Center",
            font=("Segoe UI", 24, "bold")  # Windows font
        )
        title_label.pack(side=tk.LEFT)

        subtitle_label = ttk.Label(
            title_frame,
            text="File Verification Protocol & Authorization System",
            font=("Segoe UI", 10)
        )
        subtitle_label.pack(side=tk.LEFT, padx=(10, 0))

        # Version label
        version_label = ttk.Label(
            title_frame,
            text="v1.0.0 (Windows)",
            font=("Segoe UI", 8)
        )
        version_label.pack(side=tk.RIGHT)

        # Content area with tabs
        self.notebook = ttk.Notebook(main_frame)
        self.notebook.grid(row=1, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))

        # Document Wallet Tab
        self.wallet_tab = ttk.Frame(self.notebook, padding="10")
        self.notebook.add(self.wallet_tab, text="📁 Document Wallet")
        self.setup_wallet_tab()

        # Verification Tab
        self.verify_tab = ttk.Frame(self.notebook, padding="10")
        self.notebook.add(self.verify_tab, text="✓ Verification")
        self.setup_verification_tab()

        # Entities Tab
        self.entities_tab = ttk.Frame(self.notebook, padding="10")
        self.notebook.add(self.entities_tab, text="🏛 Trusted Entities")
        self.setup_entities_tab()

        # Status bar
        status_frame = ttk.Frame(main_frame)
        status_frame.grid(row=2, column=0, sticky=(tk.W, tk.E), pady=(10, 0))

        self.status_bar = ttk.Label(
            status_frame,
            text="Ready",
            relief=tk.SUNKEN,
            anchor=tk.W
        )
        self.status_bar.pack(side=tk.LEFT, fill=tk.X, expand=True)

        # Wallet path label
        wallet_info = ttk.Label(
            status_frame,
            text=f"Wallet: {self.wallet_path}",
            relief=tk.SUNKEN,
            anchor=tk.E
        )
        wallet_info.pack(side=tk.RIGHT, padx=(5, 0))

    def setup_wallet_tab(self):
        """Setup the document wallet tab"""

        # Toolbar
        toolbar = ttk.Frame(self.wallet_tab)
        toolbar.pack(side=tk.TOP, fill=tk.X, pady=(0, 10))

        ttk.Button(toolbar, text="➕ Import", command=self.import_document).pack(side=tk.LEFT, padx=2)
        ttk.Button(toolbar, text="💾 Export", command=self.export_document).pack(side=tk.LEFT, padx=2)
        ttk.Button(toolbar, text="🔄 Refresh", command=self.load_documents).pack(side=tk.LEFT, padx=2)
        ttk.Button(toolbar, text="✓ Verify", command=self.verify_selected).pack(side=tk.LEFT, padx=2)
        ttk.Button(toolbar, text="ℹ Info", command=self.view_document_info).pack(side=tk.LEFT, padx=2)

        ttk.Separator(toolbar, orient=tk.VERTICAL).pack(side=tk.LEFT, padx=5, fill=tk.Y)

        ttk.Button(toolbar, text="📂 Open Folder", command=self.open_wallet_folder).pack(side=tk.LEFT, padx=2)

        # Document list
        list_frame = ttk.Frame(self.wallet_tab)
        list_frame.pack(side=tk.TOP, fill=tk.BOTH, expand=True)

        # Treeview for documents
        columns = ("type", "issuer", "issued", "expires", "status")
        self.doc_tree = ttk.Treeview(list_frame, columns=columns, show="tree headings")

        # Column headings
        self.doc_tree.heading("#0", text="Document")
        self.doc_tree.heading("type", text="Type")
        self.doc_tree.heading("issuer", text="Issuer")
        self.doc_tree.heading("issued", text="Issued")
        self.doc_tree.heading("expires", text="Expires")
        self.doc_tree.heading("status", text="Status")

        # Column widths
        self.doc_tree.column("#0", width=200)
        self.doc_tree.column("type", width=150)
        self.doc_tree.column("issuer", width=200)
        self.doc_tree.column("issued", width=100)
        self.doc_tree.column("expires", width=100)
        self.doc_tree.column("status", width=100)

        # Scrollbars
        vsb = ttk.Scrollbar(list_frame, orient=tk.VERTICAL, command=self.doc_tree.yview)
        hsb = ttk.Scrollbar(list_frame, orient=tk.HORIZONTAL, command=self.doc_tree.xview)
        self.doc_tree.configure(yscrollcommand=vsb.set, xscrollcommand=hsb.set)

        self.doc_tree.grid(row=0, column=0, sticky=(tk.N, tk.S, tk.E, tk.W))
        vsb.grid(row=0, column=1, sticky=(tk.N, tk.S))
        hsb.grid(row=1, column=0, sticky=(tk.E, tk.W))

        list_frame.rowconfigure(0, weight=1)
        list_frame.columnconfigure(0, weight=1)

        # Double-click to view info
        self.doc_tree.bind('<Double-1>', lambda e: self.view_document_info())

    def setup_verification_tab(self):
        """Setup the verification tab"""

        # Input frame
        input_frame = ttk.LabelFrame(self.verify_tab, text="Verify Document", padding="10")
        input_frame.pack(side=tk.TOP, fill=tk.X, pady=(0, 10))

        ttk.Label(input_frame, text="Document File:").grid(row=0, column=0, sticky=tk.W, pady=5)
        self.verify_file_var = tk.StringVar()
        entry = ttk.Entry(input_frame, textvariable=self.verify_file_var, width=60)
        entry.grid(row=0, column=1, pady=5, padx=5)
        ttk.Button(input_frame, text="Browse...", command=self.browse_verify_file).grid(row=0, column=2, padx=(0, 5), pady=5)

        ttk.Label(input_frame, text="Verification Level:").grid(row=1, column=0, sticky=tk.W, pady=5)
        self.verify_level_var = tk.StringVar(value="STANDARD")
        level_combo = ttk.Combobox(input_frame, textvariable=self.verify_level_var, width=20, state="readonly")
        level_combo['values'] = ["BASIC", "STANDARD", "COMPREHENSIVE", "STRICT"]
        level_combo.grid(row=1, column=1, sticky=tk.W, pady=5, padx=5)

        verify_btn = ttk.Button(input_frame, text="▶ Verify Document", command=self.perform_verification)
        verify_btn.grid(row=2, column=1, sticky=tk.W, pady=(10, 0), padx=5)

        # Results frame
        results_frame = ttk.LabelFrame(self.verify_tab, text="Verification Results", padding="10")
        results_frame.pack(side=tk.TOP, fill=tk.BOTH, expand=True)

        self.verify_text = tk.Text(results_frame, wrap=tk.WORD, font=("Consolas", 10))
        verify_scroll = ttk.Scrollbar(results_frame, orient=tk.VERTICAL, command=self.verify_text.yview)
        self.verify_text.configure(yscrollcommand=verify_scroll.set)

        self.verify_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        verify_scroll.pack(side=tk.RIGHT, fill=tk.Y)

    def setup_entities_tab(self):
        """Setup the trusted entities tab"""

        toolbar = ttk.Frame(self.entities_tab)
        toolbar.pack(side=tk.TOP, fill=tk.X, pady=(0, 10))

        ttk.Label(toolbar, text="Manage trusted entities for document verification",
                 font=("Segoe UI", 10)).pack(side=tk.LEFT)

        # Entity list
        columns = ("name", "type", "jurisdiction", "verified")
        self.entity_tree = ttk.Treeview(self.entities_tab, columns=columns, show="headings")

        self.entity_tree.heading("name", text="Entity Name")
        self.entity_tree.heading("type", text="Type")
        self.entity_tree.heading("jurisdiction", text="Jurisdiction")
        self.entity_tree.heading("verified", text="Verified")

        self.entity_tree.column("name", width=300)
        self.entity_tree.column("type", width=200)
        self.entity_tree.column("jurisdiction", width=100)
        self.entity_tree.column("verified", width=100)

        # Scrollbar
        vsb = ttk.Scrollbar(self.entities_tab, orient=tk.VERTICAL, command=self.entity_tree.yview)
        self.entity_tree.configure(yscrollcommand=vsb.set)

        self.entity_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        vsb.pack(side=tk.RIGHT, fill=tk.Y)

    def load_documents(self):
        """Load documents from wallet"""
        self.doc_tree.delete(*self.doc_tree.get_children())
        self.documents.clear()

        if not os.path.exists(self.wallet_path):
            os.makedirs(self.wallet_path, exist_ok=True)
            return

        # Scan wallet directory for .sec files
        for filename in os.listdir(self.wallet_path):
            if filename.endswith('.sec'):
                filepath = os.path.join(self.wallet_path, filename)
                try:
                    sec_file = SECFile.load(filepath)
                    self.documents.append((filepath, sec_file))

                    # Add to tree
                    status = "✓ Valid" if sec_file.is_valid_now() else "✗ Expired/Invalid"
                    self.doc_tree.insert("", tk.END, text=sec_file.metadata.title, values=(
                        sec_file.metadata.document_type.value,
                        sec_file.metadata.issuer.name if sec_file.metadata.issuer else "Unknown",
                        sec_file.metadata.issued_at.strftime("%Y-%m-%d") if sec_file.metadata.issued_at else "",
                        sec_file.metadata.expires_at.strftime("%Y-%m-%d") if sec_file.metadata.expires_at else "Never",
                        status
                    ))
                except Exception as e:
                    print(f"Error loading {filename}: {e}")

        self.status_bar.config(text=f"Loaded {len(self.documents)} documents from wallet")

    def import_document(self):
        """Import a .sec document"""
        filepath = filedialog.askopenfilename(
            title="Import Document",
            filetypes=[("SEC Files", "*.sec"), ("All Files", "*.*")],
            initialdir=os.path.expanduser("~\\Documents")
        )

        if filepath:
            try:
                # Copy to wallet
                filename = os.path.basename(filepath)
                dest = os.path.join(self.wallet_path, filename)

                import shutil
                shutil.copy(filepath, dest)

                self.load_documents()
                messagebox.showinfo("Success", f"Document imported successfully!\n\nSaved to wallet as:\n{filename}")
            except Exception as e:
                messagebox.showerror("Import Error", f"Failed to import document:\n\n{str(e)}")

    def export_document(self):
        """Export selected document"""
        selection = self.doc_tree.selection()
        if not selection:
            messagebox.showwarning("No Selection", "Please select a document to export")
            return

        idx = self.doc_tree.index(selection[0])
        if idx < len(self.documents):
            filepath, sec_file = self.documents[idx]

            dest = filedialog.asksaveasfilename(
                title="Export Document",
                defaultextension=".sec",
                filetypes=[("SEC Files", "*.sec"), ("All Files", "*.*")],
                initialdir=os.path.expanduser("~\\Documents"),
                initialfile=os.path.basename(filepath)
            )

            if dest:
                try:
                    import shutil
                    shutil.copy(filepath, dest)
                    messagebox.showinfo("Success", f"Document exported successfully to:\n\n{dest}")
                except Exception as e:
                    messagebox.showerror("Export Error", f"Failed to export document:\n\n{str(e)}")

    def verify_selected(self):
        """Verify the selected document"""
        selection = self.doc_tree.selection()
        if not selection:
            messagebox.showwarning("No Selection", "Please select a document to verify")
            return

        idx = self.doc_tree.index(selection[0])
        if idx < len(self.documents):
            filepath, sec_file = self.documents[idx]
            self.verify_file_var.set(filepath)
            self.notebook.select(self.verify_tab)
            self.perform_verification()

    def browse_verify_file(self):
        """Browse for file to verify"""
        filepath = filedialog.askopenfilename(
            title="Select Document to Verify",
            filetypes=[("SEC Files", "*.sec"), ("All Files", "*.*")],
            initialdir=self.wallet_path
        )
        if filepath:
            self.verify_file_var.set(filepath)

    def perform_verification(self):
        """Perform document verification"""
        filepath = self.verify_file_var.get()
        if not filepath or not os.path.exists(filepath):
            messagebox.showwarning("Invalid File", "Please select a valid document file")
            return

        try:
            # Load document
            sec_file = SECFile.load(filepath)

            # Get verification level
            level_str = self.verify_level_var.get()
            level = VerificationLevel[level_str]

            # Verify
            self.status_bar.config(text="Verifying document...")
            self.window.update()

            result = self.verification_engine.verify(sec_file, level)

            # Display results
            report = self.verification_engine.generate_verification_report(result)
            self.verify_text.delete(1.0, tk.END)
            self.verify_text.insert(1.0, report)

            self.status_bar.config(text=f"Verification complete: {result.status.value}")

            # Show popup with result
            if result.is_valid:
                messagebox.showinfo("Verification Success",
                    f"Document verified successfully!\n\nScore: {result.score:.1f}/100\nStatus: {result.status.value}")
            else:
                messagebox.showwarning("Verification Failed",
                    f"Document verification failed.\n\nStatus: {result.status.value}\n\nSee results tab for details.")

        except Exception as e:
            messagebox.showerror("Verification Error", f"Failed to verify document:\n\n{str(e)}")
            self.status_bar.config(text="Verification failed")

    def view_document_info(self):
        """View detailed document information"""
        selection = self.doc_tree.selection()
        if not selection:
            messagebox.showwarning("No Selection", "Please select a document")
            return

        idx = self.doc_tree.index(selection[0])
        if idx < len(self.documents):
            filepath, sec_file = self.documents[idx]

            # Create info window
            info_window = tk.Toplevel(self.window)
            info_window.title(f"Document Information - {sec_file.metadata.title}")
            info_window.geometry("700x600")

            # Try to set icon
            if is_windows():
                try:
                    icon_path = os.path.join(os.path.dirname(__file__), 'nix_icon.ico')
                    if os.path.exists(icon_path):
                        info_window.iconbitmap(icon_path)
                except:
                    pass

            # Create notebook for tabs
            notebook = ttk.Notebook(info_window)
            notebook.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

            # General tab
            general_frame = ttk.Frame(notebook, padding="10")
            notebook.add(general_frame, text="General")

            text = tk.Text(general_frame, wrap=tk.WORD, font=("Consolas", 10))
            scroll = ttk.Scrollbar(general_frame, orient=tk.VERTICAL, command=text.yview)
            text.configure(yscrollcommand=scroll.set)

            info = f"""Document Information
{"=" * 70}

Title: {sec_file.metadata.title}
Type: {sec_file.metadata.document_type.value}
ID: {sec_file.metadata.document_id}

Issuer: {sec_file.metadata.issuer.name if sec_file.metadata.issuer else 'Unknown'}
Issuer Type: {sec_file.metadata.issuer.entity_type.value if sec_file.metadata.issuer else 'Unknown'}
Jurisdiction: {sec_file.metadata.issuer.jurisdiction if sec_file.metadata.issuer else 'Unknown'}

Subject: {sec_file.metadata.subject.full_name if sec_file.metadata.subject else 'Unknown'}

Issued: {sec_file.metadata.issued_at.strftime('%Y-%m-%d %H:%M:%S') if sec_file.metadata.issued_at else 'Unknown'}
Expires: {sec_file.metadata.expires_at.strftime('%Y-%m-%d %H:%M:%S') if sec_file.metadata.expires_at else 'Never'}

Status: {'✓ Valid' if sec_file.is_valid_now() else '✗ Invalid/Expired'}
Revoked: {sec_file.metadata.revoked}

Description: {sec_file.metadata.description}

File Location: {filepath}
"""
            text.insert(1.0, info)
            text.configure(state='disabled')

            text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
            scroll.pack(side=tk.RIGHT, fill=tk.Y)

            # Blockchain tab
            if sec_file.blockchain_anchor:
                blockchain_frame = ttk.Frame(notebook, padding="10")
                notebook.add(blockchain_frame, text="Blockchain")

                bc_text = tk.Text(blockchain_frame, wrap=tk.WORD, font=("Consolas", 10))
                bc_scroll = ttk.Scrollbar(blockchain_frame, orient=tk.VERTICAL, command=bc_text.yview)
                bc_text.configure(yscrollcommand=bc_scroll.set)

                bc_info = f"""Blockchain Anchor
{"=" * 70}

Network: {sec_file.blockchain_anchor.network}
Transaction Hash: {sec_file.blockchain_anchor.transaction_hash}
Block Number: {sec_file.blockchain_anchor.block_number}
Timestamp: {sec_file.blockchain_anchor.timestamp}

This document has been anchored to the blockchain, providing
an immutable record of its creation and authenticity.
"""
                bc_text.insert(1.0, bc_info)
                bc_text.configure(state='disabled')

                bc_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
                bc_scroll.pack(side=tk.RIGHT, fill=tk.Y)

            # Close button
            close_btn = ttk.Button(info_window, text="Close", command=info_window.destroy)
            close_btn.pack(pady=(0, 10))

    def open_wallet_folder(self):
        """Open the wallet folder in Windows Explorer"""
        if is_windows():
            os.startfile(self.wallet_path)
        else:
            import subprocess
            subprocess.Popen(['xdg-open', self.wallet_path])

    def backup_wallet(self):
        """Backup wallet to another location"""
        dest = filedialog.askdirectory(
            title="Select Backup Location",
            initialdir=os.path.expanduser("~\\Documents")
        )

        if dest:
            try:
                import shutil
                import time

                backup_name = f"nix_wallet_backup_{time.strftime('%Y%m%d_%H%M%S')}"
                backup_path = os.path.join(dest, backup_name)

                shutil.copytree(self.wallet_path, backup_path)

                messagebox.showinfo("Backup Complete",
                    f"Wallet backed up successfully!\n\nBackup location:\n{backup_path}")
            except Exception as e:
                messagebox.showerror("Backup Error", f"Failed to backup wallet:\n\n{str(e)}")

    def show_preferences(self):
        """Show preferences dialog"""
        pref_window = tk.Toplevel(self.window)
        pref_window.title("Preferences")
        pref_window.geometry("500x400")

        ttk.Label(pref_window, text="Preferences", font=("Segoe UI", 16, "bold")).pack(pady=20)
        ttk.Label(pref_window, text="Wallet Location:").pack()
        ttk.Label(pref_window, text=self.wallet_path, foreground="gray").pack()

        ttk.Button(pref_window, text="Close", command=pref_window.destroy).pack(pady=20)

    def show_documentation(self):
        """Show documentation"""
        doc_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "README.md")
        if os.path.exists(doc_path) and is_windows():
            os.startfile(doc_path)
        else:
            messagebox.showinfo("Documentation",
                "Documentation is available in the NIX installation folder.\n\nSee README.md for complete documentation.")

    def check_updates(self):
        """Check for updates"""
        messagebox.showinfo("Check for Updates",
            "You are running NIX version 1.0.0\n\nUpdate checking will be available in a future release.")

    def show_about(self):
        """Show about dialog"""
        about_window = tk.Toplevel(self.window)
        about_window.title("About NIX")
        about_window.geometry("500x400")
        about_window.resizable(False, False)

        # Center window
        about_window.transient(self.window)
        about_window.grab_set()

        # Content
        ttk.Label(about_window, text="NIX Control Center",
                 font=("Segoe UI", 20, "bold")).pack(pady=20)

        ttk.Label(about_window, text="Version 1.0.0 (Windows)",
                 font=("Segoe UI", 10)).pack()

        ttk.Separator(about_window, orient=tk.HORIZONTAL).pack(fill=tk.X, padx=20, pady=20)

        about_text = """File Verification Protocol & Authorization System

NIX provides secure, blockchain-verified document management
for government agencies, healthcare providers, and individuals.

Features:
• Self-executing contracts (.sec files)
• Blockchain anchoring for immutability
• Multi-entity support (IRS, DMV, Healthcare, etc.)
• Advanced cryptographic verification
• HIPAA, FERPA, FCRA compliant

Part of the TL Linux Project
Licensed under GPL-3.0

Copyright © 2024 TL Linux Project"""

        text_widget = tk.Text(about_window, wrap=tk.WORD, height=15, width=50,
                             font=("Segoe UI", 9), relief=tk.FLAT)
        text_widget.insert(1.0, about_text)
        text_widget.configure(state='disabled')
        text_widget.pack(padx=20, pady=10)

        ttk.Button(about_window, text="Close", command=about_window.destroy).pack(pady=10)

    def on_closing(self):
        """Handle window closing"""
        if messagebox.askokcancel("Quit", "Do you want to quit NIX Control Center?"):
            self.window.destroy()

    def run(self):
        """Run the application"""
        self.window.protocol("WM_DELETE_WINDOW", self.on_closing)
        self.window.mainloop()


def main():
    """Main entry point"""
    # Ensure directories exist
    ensure_directories()

    # Create and run application
    app = NIXControlCenterWindows()
    app.run()


if __name__ == "__main__":
    main()
