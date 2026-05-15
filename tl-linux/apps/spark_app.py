#!/usr/bin/env python3
"""
TL Linux - Spark App
Simple app for capturing quick ideas and action sparks.
"""

import tkinter as tk
from tkinter import messagebox
from datetime import datetime
from pathlib import Path


class SparkApp:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("TL Linux - Spark")
        self.root.geometry("700x520")
        self.root.configure(bg="#1a1a1a")

        self.spark_dir = Path.home() / ".tl-linux" / "spark"
        self.spark_dir.mkdir(parents=True, exist_ok=True)
        self.spark_file = self.spark_dir / "sparks.txt"

        self.setup_ui()
        self.load_sparks()

    def setup_ui(self):
        """Create app UI."""
        header = tk.Frame(self.root, bg="#2b2b2b", height=80)
        header.pack(fill=tk.X)
        header.pack_propagate(False)

        tk.Label(
            header,
            text="✨ Spark App",
            font=("Arial", 20, "bold"),
            bg="#2b2b2b",
            fg="#ffd166"
        ).pack(side=tk.LEFT, padx=20, pady=20)

        tk.Label(
            header,
            text="Capture your next small win",
            font=("Arial", 11),
            bg="#2b2b2b",
            fg="#c7d0d9"
        ).pack(side=tk.LEFT, pady=22)

        body = tk.Frame(self.root, bg="#1a1a1a")
        body.pack(fill=tk.BOTH, expand=True, padx=14, pady=14)

        tk.Label(
            body,
            text="New Spark:",
            font=("Arial", 11, "bold"),
            bg="#1a1a1a",
            fg="white",
            anchor="w"
        ).pack(fill=tk.X)

        self.spark_input = tk.Text(
            body,
            height=5,
            bg="#2b2b2b",
            fg="white",
            insertbackground="white",
            font=("Arial", 11),
            bd=0,
            padx=10,
            pady=10
        )
        self.spark_input.pack(fill=tk.X, pady=(6, 10))

        controls = tk.Frame(body, bg="#1a1a1a")
        controls.pack(fill=tk.X, pady=(0, 10))

        tk.Button(
            controls,
            text="➕ Save Spark",
            command=self.save_spark,
            bg="#4a9eff",
            fg="white",
            bd=0,
            padx=14,
            pady=8,
            cursor="hand2"
        ).pack(side=tk.LEFT, padx=(0, 8))

        tk.Button(
            controls,
            text="🧹 Clear Input",
            command=lambda: self.spark_input.delete("1.0", tk.END),
            bg="#3a3a3a",
            fg="white",
            bd=0,
            padx=14,
            pady=8,
            cursor="hand2"
        ).pack(side=tk.LEFT, padx=(0, 8))

        tk.Button(
            controls,
            text="🗑 Clear All Sparks",
            command=self.clear_all_sparks,
            bg="#ff5555",
            fg="white",
            bd=0,
            padx=14,
            pady=8,
            cursor="hand2"
        ).pack(side=tk.RIGHT)

        tk.Label(
            body,
            text="Saved Sparks:",
            font=("Arial", 11, "bold"),
            bg="#1a1a1a",
            fg="white",
            anchor="w"
        ).pack(fill=tk.X, pady=(4, 6))

        list_frame = tk.Frame(body, bg="#1a1a1a")
        list_frame.pack(fill=tk.BOTH, expand=True)

        scrollbar = tk.Scrollbar(list_frame)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        self.spark_list = tk.Listbox(
            list_frame,
            bg="#2b2b2b",
            fg="white",
            selectbackground="#4a9eff",
            selectforeground="white",
            font=("Arial", 10),
            bd=0,
            highlightthickness=0,
            yscrollcommand=scrollbar.set
        )
        self.spark_list.pack(fill=tk.BOTH, expand=True)
        scrollbar.config(command=self.spark_list.yview)

    def load_sparks(self):
        """Load saved sparks into list."""
        self.spark_list.delete(0, tk.END)
        if not self.spark_file.exists():
            return

        lines = self.spark_file.read_text(encoding="utf-8").splitlines()
        for line in lines:
            if line.strip():
                self.spark_list.insert(tk.END, line)

    def save_spark(self):
        """Save a new spark entry."""
        text = self.spark_input.get("1.0", tk.END).strip()
        if not text:
            messagebox.showwarning("Spark App", "Please enter a spark first.")
            return

        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
        entry = f"[{timestamp}] {text}"

        with open(self.spark_file, "a", encoding="utf-8") as f:
            f.write(entry + "\n")

        self.spark_input.delete("1.0", tk.END)
        self.spark_list.insert(tk.END, entry)
        self.spark_list.see(tk.END)

    def clear_all_sparks(self):
        """Delete all spark entries."""
        confirmed = messagebox.askyesno(
            "Spark App",
            "Clear all saved sparks? This cannot be undone."
        )
        if not confirmed:
            return

        if self.spark_file.exists():
            self.spark_file.unlink()
        self.spark_list.delete(0, tk.END)

    def run(self):
        """Run the app."""
        self.root.mainloop()


if __name__ == "__main__":
    app = SparkApp()
    app.run()
