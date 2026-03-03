# Welcome to Your First Coding Project in Cursor

This is a simple project to help you get started with Python using the Cursor IDE.  
You'll write your very first scripts here, while Cursor (with AI) acts as your tutor and guide.  
Let's explore this workspace together:

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Getting to Know Cursor](#getting-to-know-cursor)
   - [Exploring the Project Files](#exploring-the-project-files)
   - [How to Run Code](#how-to-run-code)
   - [Setup](#setup)
     - [Quick Start: Activate Your Environment](#quick-start-activate-your-environment)
     - [First Time Setup](#first-time-setup)
   - [Working with Secrets](#working-with-secrets-api-keys-passwords)
3. [Your First Challenge: Understanding the Code](#your-first-challenge-understanding-the-code)

---

## Prerequisites

Before you start coding, make sure you have these tools installed on your computer:

### 1. Python 3.13+

Python is the programming language you'll be learning! Let's check if you have it:

**🪟 Windows:**

```powershell
python --version
```

**🍎 Mac/Linux:**

```bash
python3 --version
```

**Don't have Python?** Here's how to install it:

**🪟 Windows:**

- **Easy way:** Open PowerShell and run:

  ```powershell
  winget install Python.Python.3.13
  ```

- **Manual way:** Download from [python.org](https://www.python.org/downloads/) and run the installer  
  ⚠️ **Important:** Check the box "Add Python to PATH" during installation!

**🍎 Mac:**

- **Easy way (using Homebrew):**

  ```bash
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  brew install python3
  ```

- **Manual way:** Download from [python.org](https://www.python.org/downloads/) and run the installer

### 2. Git

Git helps you save and track changes to your code. Let's check if you have it:

```bash
git --version
```

**Don't have Git?** Here's how to install it:

**🪟 Windows:**

- **Easy way:** Open PowerShell and run:

  ```powershell
  winget install Git.Git
  ```

- **Manual way:** Download from [git-scm.com](https://git-scm.com/downloads)

**🍎 Mac:**

- **Easy way (using Homebrew):**

  ```bash
  brew install git
  ```

- **Manual way:** Download from [git-scm.com](https://git-scm.com/downloads)

### 3. Cursor IDE

You're probably already using Cursor if you're reading this! If not, download it from [cursor.sh](https://cursor.sh).

> **💡 Note:** This project also works with VS Code, but Cursor is recommended for the built-in AI features.

**Need detailed setup help?** Check out the full guides:

- [🪟 Windows Setup Guide](setup_windows.md)
- [🍎 Mac Setup Guide](setup_mac.md)

---

## Getting to Know Cursor

Your screen has a few key areas:

- **Explorer (Left Side)**: Like a file cabinet — it shows all project files (like `main.py`). Click a file to open it.
- **Editor (Center)**: Your workbench. This is where you’ll write and edit code.
- **Terminal (Bottom)**: Your command center. Run commands here to execute your scripts and see results.
- **Cursor Chat (Right Side)**: Your AI assistant. You can ask questions about your code, concepts, or next steps.  
  Remember: the AI will explain logic simply, not overwhelm you with code details.

### Exploring the Project Files

- **`main.py`**: This is the main file where you will write your Python code. For now, this is the only file you need to focus on.
- **Other Files**: You might see files like `.cursorrules`, `.github/copilot-instructions.md`,`requirements.txt`, or `.vscode`. Don’t worry about these — they exist to make the environment easier and to guide the AI assistant.

---

### How to Run Code

Now let’s run the code you just explored:

1. Make sure `main.py` is open in the **Editor**.
2. Click into the **Terminal** at the bottom.
3. Run this command:

```bash
python main.py
```

1. You should see this message appear in the terminal:

```sh
Hello, world!
```

🎉 Congrats, you just ran your first Python program in Cursor!

---

### Setup

**Good news!** A Python environment is already prepared for you. 🎉  

When you open a terminal, you might see `(.venv)` at the start of the prompt, like this:

```sh
(.venv) vibecoding-02-03-68307615:$
```

This means your environment is ready! If you see this, skip to [Your First Challenge](#your-first-challenge-understanding-the-code).

---

#### Quick Start: Activate Your Environment

If you don't see `(.venv)` in your terminal, run this commands:

**🪟 Windows:**

```powershell
.\.venv\Scripts\Activate.ps1
```

**🍎 Mac/Linux:**

```bash
source .venv/bin/activate
```

---

#### First Time Setup

Need to create your environment from scratch? Follow the full setup guide for your system:

- **[🪟 Windows Setup Guide](setup_windows.md)** - Complete instructions including Python installation
- **[🍎 Mac Setup Guide](setup_mac.md)** - Complete instructions including Python installation

---

### Working with Secrets (API Keys, Passwords)

**Important:** Never put passwords or API keys directly in your code!

#### Using a `.env` File

When you need to store secrets (like API keys), create a file named `.env` in your project folder:

1. Right-click in the Explorer → New File → Name it `.env`
2. Add your secrets, one per line:

   ```sh
   API_KEY=your_secret_key_here
   PASSWORD=your_password_here
   ```

3. Ask Cursor AI: **"Use my API key from the .env file"**

Cursor will help you load and use these secrets properly in your code.

> **💡 Tip:** Your `.env` file is already protected by `.gitignore`, so it won't be uploaded to GitHub. Your secrets stay private!

#### ⚠️ Important Rules

- **Never** write secrets directly in your code
- **Always** use a `.env` file for passwords, API keys, and tokens
- **Ask Cursor** to help you use environment variables when you need them

---

## Your First Challenge: Understanding the Code

Before running anything, let’s ask Cursor what the code means.

In the **Cursor Chat**, on the right side, type:

```text
Can you explain what the code in `main.py` does?
```

You’ll get a simple, logical explanation of what the program does, not just a code breakdown.
