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
    expanded = os.path.expanduser(path)
    if not os.path.exists(expanded):
        return {"success": False, "message": f"Path not found: {expanded}"}
    try:
        subprocess.Popen(["code", expanded], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return {"success": True, "message": f"Opened {expanded} in VS Code"}
    except Exception as e:
        return {"success": False, "message": f"Failed to open VS Code: {str(e)}"}


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


def execute_action(action: str, params: str) -> dict:
    """Execute an action based on AI response parsing."""
    action = action.upper().strip()

    if action == "OPEN_APP":
        return open_app(params)
    elif action == "OPEN_URL":
        return open_url(params)
    elif action == "RUN_COMMAND":
        return run_shell(params)
    elif action == "OPEN_VSCODE":
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
    else:
        return {"success": False, "message": f"Unknown action: {action}"}
