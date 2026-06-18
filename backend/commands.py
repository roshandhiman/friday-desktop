"""
Friday AI — Command Execution Module
Handles opening apps, URLs, running shell commands, and IDE integration on macOS.
"""

import subprocess
import os
import json
import webbrowser
import platform


# Common macOS app name mappings
APP_ALIASES = {
    "whatsapp": "WhatsApp",
    "youtube": None,  # Opens in browser
    "chrome": "Google Chrome",
    "google chrome": "Google Chrome",
    "safari": "Safari",
    "firefox": "Firefox",
    "vscode": "Visual Studio Code",
    "vs code": "Visual Studio Code",
    "visual studio code": "Visual Studio Code",
    "visual studio": "Visual Studio Code",
    "code": "Visual Studio Code",
    "antigravity": "Antigravity",
    "terminal": "Terminal",
    "iterm": "iTerm",
    "finder": "Finder",
    "spotify": "Spotify",
    "slack": "Slack",
    "discord": "Discord",
    "telegram": "Telegram",
    "notes": "Notes",
    "calculator": "Calculator",
    "camera": "FaceTime",
    "facetime": "FaceTime",
    "photo booth": "Photo Booth",
    "photos": "Photos",
    "music": "Music",
    "messages": "Messages",
    "mail": "Mail",
    "calendar": "Calendar",
    "settings": "System Preferences",
    "system preferences": "System Preferences",
    "system settings": "System Settings",
    "activity monitor": "Activity Monitor",
    "preview": "Preview",
    "pages": "Pages",
    "numbers": "Numbers",
    "keynote": "Keynote",
    "xcode": "Xcode",
}

# URL mappings for web services
WEB_URLS = {
    "youtube": "https://www.youtube.com",
    "google": "https://www.google.com",
    "gmail": "https://mail.google.com",
    "github": "https://github.com",
    "twitter": "https://twitter.com",
    "x": "https://x.com",
    "instagram": "https://www.instagram.com",
    "facebook": "https://www.facebook.com",
    "linkedin": "https://www.linkedin.com",
    "reddit": "https://www.reddit.com",
    "stackoverflow": "https://stackoverflow.com",
    "chatgpt": "https://chat.openai.com",
    "claude": "https://claude.ai",
    "netflix": "https://www.netflix.com",
    "amazon": "https://www.amazon.in",
    "flipkart": "https://www.flipkart.com",
}


def open_app(app_name: str) -> dict:
    """Open a macOS application by name."""
    name_lower = app_name.strip().lower()

    # Check if it's a web service that should open in browser
    if name_lower in WEB_URLS:
        return open_url(WEB_URLS[name_lower])

    # Resolve alias
    resolved = APP_ALIASES.get(name_lower, app_name.strip())
    if resolved is None:
        # None means it's a web service
        if name_lower in WEB_URLS:
            return open_url(WEB_URLS[name_lower])
        return {"success": False, "message": f"Don't know how to open {app_name}"}

    try:
        subprocess.Popen(["open", "-a", resolved], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return {"success": True, "message": f"Opened {resolved}"}
    except Exception as e:
        return {"success": False, "message": f"Failed to open {resolved}: {str(e)}"}


def open_url(url: str) -> dict:
    """Open a URL in the default browser."""
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    try:
        webbrowser.open(url)
        return {"success": True, "message": f"Opened {url}"}
    except Exception as e:
        return {"success": False, "message": f"Failed to open URL: {str(e)}"}


def run_shell(command: str) -> dict:
    """Run a shell command and return output."""
    # Safety: block dangerous commands
    dangerous = ["rm -rf /", "mkfs", "dd if=", ":(){ :|:& };:"]
    for d in dangerous:
        if d in command:
            return {"success": False, "message": "Blocked dangerous command"}

    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=30,
            cwd=os.path.expanduser("~"),
        )
        output = result.stdout.strip() or result.stderr.strip()
        return {
            "success": result.returncode == 0,
            "message": output[:2000] if output else "Command executed",
            "return_code": result.returncode,
        }
    except subprocess.TimeoutExpired:
        return {"success": False, "message": "Command timed out (30s limit)"}
    except Exception as e:
        return {"success": False, "message": f"Error: {str(e)}"}


def open_in_vscode(path: str) -> dict:
    """Open a file or folder in VS Code."""
    path = path.strip()
    # If path is empty, placeholder, or does not exist, fall back to opening VS Code app itself
    if not path or "path/to" in path or path.lower() in ("path", "folder"):
        return open_app("Visual Studio Code")

    expanded = os.path.expanduser(path)
    if not os.path.exists(expanded):
        # Fallback: check if the file/folder exists on the Desktop
        basename = os.path.basename(expanded)
        desktop_path = os.path.expanduser(f"~/Desktop/{basename}")
        if os.path.exists(desktop_path):
            expanded = desktop_path
        else:
            return open_app("Visual Studio Code")
    try:
        subprocess.Popen(["code", expanded], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return {"success": True, "message": f"Opened {expanded} in VS Code"}
    except Exception as e:
        return open_app("Visual Studio Code")


def take_screenshot() -> dict:
    """Take a screenshot and save to Desktop."""
    try:
        path = os.path.expanduser("~/Desktop/friday_screenshot.png")
        subprocess.run(["screencapture", "-x", path], check=True)
        return {"success": True, "message": f"Screenshot saved to {path}", "path": path}
    except Exception as e:
        return {"success": False, "message": f"Screenshot failed: {str(e)}"}


def get_system_info() -> dict:
    """Get basic system information."""
    return {
        "success": True,
        "message": json.dumps({
            "os": platform.system(),
            "os_version": platform.mac_ver()[0],
            "machine": platform.machine(),
            "processor": platform.processor(),
            "python": platform.python_version(),
        }),
    }

def send_via_gui_search(contact: str, message: str) -> dict:
    """Fallback to search inside WhatsApp GUI using AppleScript keystrokes (requires Accessibility)."""
    import subprocess
    
    try:
        # Set clipboard to the message
        process = subprocess.Popen(['pbcopy'], stdin=subprocess.PIPE)
        process.communicate(input=message.encode('utf-8'))
        
        escaped_contact = contact.replace('"', '\\"')
        
        applescript = f'''
        tell application "WhatsApp" to activate
        delay 2
        tell application "System Events"
            -- Press cmd+F to search
            keystroke "f" using {{command down}}
            delay 0.8
            
            -- Type contact name
            keystroke "{escaped_contact}"
            delay 1.2
            
            -- Press Enter to open the chat
            key code 36
            delay 0.8
            
            -- Paste the message from clipboard
            keystroke "v" using {{command down}}
            delay 0.5
            
            -- Press Enter to send
            key code 36
        end tell
        '''
        subprocess.run(["osascript", "-e", applescript], check=True)
        return {"success": True, "message": f"Searched and sent message to {contact} via WhatsApp GUI."}
    except Exception as e:
        return {
            "success": False, 
            "message": (
                f"Could not find contact '{contact}' in your macOS Contacts book, "
                "and WhatsApp GUI automation failed. Please ensure the contact is in your Contacts "
                "or grant Accessibility permissions to Terminal/Friday in System Settings."
            )
        }


def send_whatsapp_message(contact: str, message: str) -> dict:
    """Send a WhatsApp message by searching contacts or phone number, with auto-send fallback."""
    import subprocess
    import urllib.parse
    import re

    # 1. Clean the contact name to check if it's already a phone number
    is_phone = re.match(r'^\+?[0-9\s\-()]{7,20}$', contact)
    phone = ""

    if is_phone:
        phone = contact
    else:
        # Lookup contact name in macOS Address Book (Contacts)
        applescript_contacts = f'''
        tell application "Contacts"
            set foundPeople to people whose (first name contains "{contact}" or last name contains "{contact}" or name contains "{contact}")
            if foundPeople is not {{}} then
                set firstPerson to item 1 of foundPeople
                set phoneList to value of phones of firstPerson
                if phoneList is not {{}} then
                    return item 1 of phoneList
                end if
            end if
            return ""
        end tell
        '''
        try:
            res = subprocess.run(["osascript", "-e", applescript_contacts], capture_output=True, text=True, check=True)
            phone = res.stdout.strip()
        except Exception as e:
            print("[WhatsApp] Contacts lookup failed:", e)

    if not phone:
        # Fallback to searching inside WhatsApp GUI (requires Accessibility permissions)
        return send_via_gui_search(contact, message)

    # 2. Open via WhatsApp deep link (100% robust, focuses chat & pre-fills message)
    clean_phone = re.sub(r'\D', '', phone)
    encoded_message = urllib.parse.quote(message)
    deeplink_url = f"whatsapp://send?phone={clean_phone}&text={encoded_message}"
    
    try:
        subprocess.run(["open", deeplink_url], check=True)
        
        # 3. Optional: Try to press Enter automatically via AppleScript System Events
        # (This will succeed if the user has granted Accessibility permissions to Friday/Terminal,
        # and fail silently if not, leaving the pre-filled text for the user to send manually.)
        applescript_send = '''
        delay 1.5
        tell application "System Events"
            -- Press Enter to send
            key code 36
        end tell
        '''
        subprocess.run(["osascript", "-e", applescript_send], capture_output=False, stderr=subprocess.DEVNULL, timeout=5)
        
        return {
            "success": True,
            "message": f"Opened WhatsApp chat with {contact} ({clean_phone}) and populated message."
        }
    except Exception as e:
        return {"success": False, "message": f"Failed to send deep link: {str(e)}"}

def search_youtube(query: str) -> dict:
    """Search YouTube for a query."""
    import urllib.parse
    encoded = urllib.parse.quote(query)
    url = f"https://www.youtube.com/results?search_query={encoded}"
    return open_url(url)


def search_google(query: str) -> dict:
    """Search Google for a query."""
    import urllib.parse
    encoded = urllib.parse.quote(query)
    url = f"https://www.google.com/search?q={encoded}"
    return open_url(url)

def play_spotify(query: str) -> dict:
    """Play Spotify or search and play a song on Spotify."""
    try:
        query = query.strip() if query else ""
        if query:
            import urllib.parse
            encoded = urllib.parse.quote(query)
            subprocess.Popen(["open", f"spotify:search:{encoded}"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            
            import threading
            import time
            def play_in_background():
                time.sleep(2.0)
                escaped_query = query.replace('"', '\\"')
                script = f'''
                tell application "Spotify" to activate
                delay 0.5
                tell application "System Events"
                    keystroke "l" using {{command down}}
                    delay 0.5
                    keystroke "{escaped_query}"
                    delay 1.5
                    key code 125
                    delay 0.2
                    key code 125
                    delay 0.2
                    key code 125
                    delay 0.2
                    key code 125
                    delay 0.2
                    key code 125
                    delay 0.2
                    key code 36
                end tell
                '''
                subprocess.run(["osascript", "-e", script], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                
            threading.Thread(target=play_in_background, daemon=True).start()
            message = f"Searching and playing {query} on Spotify"
        else:
            subprocess.run(["osascript", "-e", 'tell application "Spotify" to play'], check=True)
            message = "Playing Spotify"
            
        return {"success": True, "message": message}
    except Exception as e:
        return {"success": False, "message": f"Failed to play Spotify: {str(e)}"}


def create_file(params: str) -> dict:
    """Create a file on disk. params format: path|content"""
    if "|" not in params:
        return {"success": False, "message": "Invalid CREATE_FILE format. Expected path|content"}

    path, content = params.split("|", 1)
    path = path.strip()
    expanded = os.path.expanduser(path)

    try:
        # Create parent directories if needed
        parent_dir = os.path.dirname(expanded)
        if parent_dir and not os.path.exists(parent_dir):
            os.makedirs(parent_dir, exist_ok=True)

        with open(expanded, "w", encoding="utf-8") as f:
            f.write(content)

        return {"success": True, "message": f"File created at {expanded}", "path": expanded}
    except Exception as e:
        return {"success": False, "message": f"Failed to create file: {str(e)}"}


def open_file(path: str) -> dict:
    """Open a file with the default macOS application."""
    path = path.strip()
    expanded = os.path.expanduser(path)
    if not os.path.exists(expanded):
        # Fallback: check if the file exists on the Desktop
        basename = os.path.basename(expanded)
        desktop_path = os.path.expanduser(f"~/Desktop/{basename}")
        if os.path.exists(desktop_path):
            expanded = desktop_path
        else:
            return {"success": False, "message": f"File not found: {expanded}"}
    try:
        subprocess.Popen(["open", expanded], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return {"success": True, "message": f"Opened {expanded}"}
    except Exception as e:
        return {"success": False, "message": f"Failed to open file: {str(e)}"}


def execute_action(action: str, params: str) -> dict:
    """Execute an action based on AI response parsing."""
    action = action.upper().strip()

    if action == "OPEN_APP":
        return open_app(params)
    elif action == "OPEN_URL":
        return open_url(params)
    elif action == "RUN_COMMAND":
        return run_shell(params)
    elif action in ("OPEN_VSCODE", "OPEN_IN_VSCODE"):
        return open_in_vscode(params)
    elif action == "SCREENSHOT":
        return take_screenshot()
    elif action == "SYSTEM_INFO":
        return get_system_info()
    elif action == "SEND_WHATSAPP":
        if "|" in params:
            contact, message = params.split("|", 1)
            return send_whatsapp_message(contact.strip(), message.strip())
        else:
            return {"success": False, "message": "Invalid WhatsApp params"}
    elif action == "SEARCH_YOUTUBE":
        return search_youtube(params)
    elif action == "SEARCH_GOOGLE":
        return search_google(params)
    elif action == "PLAY_SPOTIFY":
        return play_spotify(params)
    elif action == "CREATE_FILE":
        return create_file(params)
    elif action == "OPEN_FILE":
        return open_file(params)
    else:
        return {"success": False, "message": f"Unknown action: {action}"}

