#!/usr/bin/env python3
"""
NIX Control Center
Main GUI application for managing .sec files and verifications
"""

import tkinter as tk
from tkinter import ttk, messagebox, filedialog
import os
import sys
from pathlib import Path
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.models import Individual, Household, DocumentType, VerificationStatus
from core.sec_file import SECFile
from core.verification import VerificationEngine, VerificationLevel


class NIXControlCenter:
    """
    NIX Control Center - Main application for managing documents
    """

    def __init__(self):
        self.window = tk.Tk()
        self.window.title("NIX Control Center")
        self.window.geometry("1200x800")

        # Data
        self.wallet_path = os.path.expanduser("~/.nix/wallet")
        self.documents = []
        self.verification_engine = VerificationEngine()

        # Create wallet directory
        os.makedirs(self.wallet_path, exist_ok=True)

        # Setup UI
        self.setup_ui()
        self.load_documents()

    def setup_ui(self):
        """Setup the user interface"""

        # Menu Bar
        menubar = tk.Menu(self.window)
        self.window.config(menu=menubar)

        # File menu
        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="File", menu=file_menu)
        file_menu.add_command(label="Import Document", command=self.import_document)
        file_menu.add_command(label="Export Document", command=self.export_document)
        file_menu.add_separator()
        file_menu.add_command(label="Exit", command=self.window.quit)

        # Tools menu
        tools_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="Tools", menu=tools_menu)
        tools_menu.add_command(label="Verify Document", command=self.verify_selected)
        tools_menu.add_command(label="View Document Info", command=self.view_document_info)
        tools_menu.add_separator()
        tools_menu.add_command(label="Settings", command=self.show_settings)

        # Help menu
        help_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="Help", menu=help_menu)
        help_menu.add_command(label="About NIX", command=self.show_about)
        help_menu.add_command(label="Documentation", command=self.show_documentation)

        # Main container
        main_frame = ttk.Frame(self.window, padding="10")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))

        # Configure grid weights
        self.window.columnconfigure(0, weight=1)
        self.window.rowconfigure(0, weight=1)
        main_frame.columnconfigure(0, weight=1)
        main_frame.rowconfigure(1, weight=1)

        # Title
        title_frame = ttk.Frame(main_frame)
        title_frame.grid(row=0, column=0, sticky=(tk.W, tk.E), pady=(0, 10))

        title_label = ttk.Label(
            title_frame,
            text="NIX Control Center",
            font=("Arial", 24, "bold")
        )
        title_label.pack(side=tk.LEFT)

        subtitle_label = ttk.Label(
            title_frame,
            text="File Verification Protocol & Authorization System",
            font=("Arial", 10)
        )
        subtitle_label.pack(side=tk.LEFT, padx=(10, 0))

        # Content area with tabs
        self.notebook = ttk.Notebook(main_frame)
        self.notebook.grid(row=1, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))

        # Document Wallet Tab
        self.wallet_tab = ttk.Frame(self.notebook, padding="10")
        self.notebook.add(self.wallet_tab, text="Document Wallet")
        self.setup_wallet_tab()

        # Verification Tab
        self.verify_tab = ttk.Frame(self.notebook, padding="10")
        self.notebook.add(self.verify_tab, text="Verification")
        self.setup_verification_tab()

        # Entities Tab
        self.entities_tab = ttk.Frame(self.notebook, padding="10")
        self.notebook.add(self.entities_tab, text="Trusted Entities")
        self.setup_entities_tab()

        # Status bar
        self.status_bar = ttk.Label(
            main_frame,
            text="Ready",
            relief=tk.SUNKEN,
            anchor=tk.W
        )
        self.status_bar.grid(row=2, column=0, sticky=(tk.W, tk.E), pady=(10, 0))

    def setup_wallet_tab(self):
        """Setup the document wallet tab"""

        # Toolbar
        toolbar = ttk.Frame(self.wallet_tab)
        toolbar.pack(side=tk.TOP, fill=tk.X, pady=(0, 10))

        ttk.Button(toolbar, text="Import Document", command=self.import_document).pack(side=tk.LEFT, padx=2)
        ttk.Button(toolbar, text="Refresh", command=self.load_documents).pack(side=tk.LEFT, padx=2)
        ttk.Button(toolbar, text="Verify", command=self.verify_selected).pack(side=tk.LEFT, padx=2)
        ttk.Button(toolbar, text="View Info", command=self.view_document_info).pack(side=tk.LEFT, padx=2)

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

        # Scrollbar
        scrollbar = ttk.Scrollbar(list_frame, orient=tk.VERTICAL, command=self.doc_tree.yview)
        self.doc_tree.configure(yscrollcommand=scrollbar.set)

        self.doc_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

    def setup_verification_tab(self):
        """Setup the verification tab"""

        # Input frame
        input_frame = ttk.LabelFrame(self.verify_tab, text="Verify Document", padding="10")
        input_frame.pack(side=tk.TOP, fill=tk.X, pady=(0, 10))

        ttk.Label(input_frame, text="Document File:").grid(row=0, column=0, sticky=tk.W, pady=2)
        self.verify_file_var = tk.StringVar()
        ttk.Entry(input_frame, textvariable=self.verify_file_var, width=50).grid(row=0, column=1, pady=2)
        ttk.Button(input_frame, text="Browse", command=self.browse_verify_file).grid(row=0, column=2, padx=(5, 0), pady=2)

        ttk.Label(input_frame, text="Verification Level:").grid(row=1, column=0, sticky=tk.W, pady=2)
        self.verify_level_var = tk.StringVar(value="STANDARD")
        level_combo = ttk.Combobox(input_frame, textvariable=self.verify_level_var, width=20, state="readonly")
        level_combo['values'] = ["BASIC", "STANDARD", "COMPREHENSIVE", "STRICT"]
        level_combo.grid(row=1, column=1, sticky=tk.W, pady=2)

        ttk.Button(input_frame, text="Verify", command=self.perform_verification).grid(row=2, column=1, sticky=tk.W, pady=(10, 0))

        # Results frame
        results_frame = ttk.LabelFrame(self.verify_tab, text="Verification Results", padding="10")
        results_frame.pack(side=tk.TOP, fill=tk.BOTH, expand=True)

        self.verify_text = tk.Text(results_frame, wrap=tk.WORD, font=("Courier", 10))
        verify_scroll = ttk.Scrollbar(results_frame, orient=tk.VERTICAL, command=self.verify_text.yview)
        self.verify_text.configure(yscrollcommand=verify_scroll.set)

        self.verify_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        verify_scroll.pack(side=tk.RIGHT, fill=tk.Y)

    def setup_entities_tab(self):
        """Setup the trusted entities tab"""

        toolbar = ttk.Frame(self.entities_tab)
        toolbar.pack(side=tk.TOP, fill=tk.X, pady=(0, 10))

        ttk.Label(toolbar, text="Manage trusted entities for document verification").pack(side=tk.LEFT)

        # Entity list
        columns = ("name", "type", "jurisdiction", "verified")
        self.entity_tree = ttk.Treeview(self.entities_tab, columns=columns, show="headings")

        self.entity_tree.heading("name", text="Entity Name")
        self.entity_tree.heading("type", text="Type")
        self.entity_tree.heading("jurisdiction", text="Jurisdiction")
        self.entity_tree.heading("verified", text="Verified")

        self.entity_tree.pack(side=tk.TOP, fill=tk.BOTH, expand=True)

    def load_documents(self):
        """Load documents from wallet"""
        self.doc_tree.delete(*self.doc_tree.get_children())
        self.documents.clear()

        if not os.path.exists(self.wallet_path):
            return

        # Scan wallet directory for .sec files
        for filename in os.listdir(self.wallet_path):
            if filename.endswith('.sec'):
                filepath = os.path.join(self.wallet_path, filename)
                try:
                    sec_file = SECFile.load(filepath)
                    self.documents.append((filepath, sec_file))

                    # Add to tree
                    status = "Valid" if sec_file.is_valid_now() else "Expired/Invalid"
                    self.doc_tree.insert("", tk.END, text=sec_file.metadata.title, values=(
                        sec_file.metadata.document_type.value,
                        sec_file.metadata.issuer.name if sec_file.metadata.issuer else "Unknown",
                        sec_file.metadata.issued_at.strftime("%Y-%m-%d") if sec_file.metadata.issued_at else "",
                        sec_file.metadata.expires_at.strftime("%Y-%m-%d") if sec_file.metadata.expires_at else "Never",
                        status
                    ))
                except Exception as e:
                    print(f"Error loading {filename}: {e}")

        self.status_bar.config(text=f"Loaded {len(self.documents)} documents")

    def import_document(self):
        """Import a .sec document"""
        filepath = filedialog.askopenfilename(
            title="Import Document",
            filetypes=[("SEC Files", "*.sec"), ("All Files", "*.*")]
        )

        if filepath:
            try:
                # Copy to wallet
                filename = os.path.basename(filepath)
                dest = os.path.join(self.wallet_path, filename)

                import shutil
                shutil.copy(filepath, dest)

                self.load_documents()
                messagebox.showinfo("Success", "Document imported successfully")
            except Exception as e:
                messagebox.showerror("Error", f"Failed to import document: {e}")

    def export_document(self):
        """Export selected document"""
        selection = self.doc_tree.selection()
        if not selection:
            messagebox.showwarning("No Selection", "Please select a document to export")
            return

        # Implementation would go here
        messagebox.showinfo("Export", "Export functionality coming soon")

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
            filetypes=[("SEC Files", "*.sec"), ("All Files", "*.*")]
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
            result = self.verification_engine.verify(sec_file, level)

            # Display results
            report = self.verification_engine.generate_verification_report(result)
            self.verify_text.delete(1.0, tk.END)
            self.verify_text.insert(1.0, report)

        except Exception as e:
            messagebox.showerror("Verification Error", f"Failed to verify document: {e}")

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
            info_window.title("Document Information")
            info_window.geometry("600x500")

            text = tk.Text(info_window, wrap=tk.WORD, font=("Courier", 10))
            text.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

            # Display info
            info = f"""Document Information
{"=" * 60}

Title: {sec_file.metadata.title}
Type: {sec_file.metadata.document_type.value}
ID: {sec_file.metadata.document_id}

Issuer: {sec_file.metadata.issuer.name if sec_file.metadata.issuer else 'Unknown'}
Subject: {sec_file.metadata.subject.full_name if sec_file.metadata.subject else 'Unknown'}

Issued: {sec_file.metadata.issued_at.strftime('%Y-%m-%d %H:%M:%S') if sec_file.metadata.issued_at else 'Unknown'}
Expires: {sec_file.metadata.expires_at.strftime('%Y-%m-%d %H:%M:%S') if sec_file.metadata.expires_at else 'Never'}

Status: {'Valid' if sec_file.is_valid_now() else 'Invalid/Expired'}
Revoked: {sec_file.metadata.revoked}

Blockchain Anchor: {sec_file.blockchain_anchor.transaction_hash if sec_file.blockchain_anchor else 'None'}

Description: {sec_file.metadata.description}
"""
            text.insert(1.0, info)
            text.configure(state='disabled')

    def show_settings(self):
        """Show settings dialog"""
        messagebox.showinfo("Settings", "Settings functionality coming soon")

    def show_about(self):
        """Show about dialog"""
        about_text = """NIX Control Center v1.0.0

File Verification Protocol & Authorization System

NIX provides secure, blockchain-verified document management
for government agencies, healthcare providers, and individuals.

Part of the TL Linux Project
Licensed under GPL-3.0"""

        messagebox.showinfo("About NIX", about_text)

    def show_documentation(self):
        """Show documentation"""
        messagebox.showinfo("Documentation", "Opening documentation...")

    def run(self):
        """Run the application"""
        self.window.mainloop()


def main():
    """Main entry point"""
    app = NIXControlCenter()
    app.run()


if __name__ == "__main__":
    main()
