"""
=============================================================================
🛡️ ADITYA ENTERPRISES — 100% FREE WHATSAPP BULK SENDER (TEXT + IMAGE)
=============================================================================
Features:
- Dual-Engine Photo Attachment: Native Clipboard Paste + File Input Fallback.
- Customizable Message: Edit anytime in 'message.txt' or console with {{name}}.
- Auto-Detects Excel in project folder AND Downloads folder.
- Anti-Ban Protection: Humanized random delay (10-18s) + Batch resting.
- Auto-Resume: Saves progress in 'sent_log.txt' with option to reset.
- Persistent Session: Scans QR code only ONCE (.wa_chrome_profile).
=============================================================================
"""

import os
import sys
import time
import random
import glob
import subprocess
import openpyxl
import pyperclip

# Force UTF-8 output on Windows console
try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from webdriver_manager.chrome import ChromeDriverManager

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DOWNLOADS_DIR = os.path.join(os.path.expanduser("~"), "Downloads")
SENT_LOG_FILE = os.path.join(SCRIPT_DIR, "sent_log.txt")
INVALID_LOG_FILE = os.path.join(SCRIPT_DIR, "invalid_numbers.txt")
CHROME_PROFILE_DIR = os.path.join(SCRIPT_DIR, ".wa_chrome_profile")
MESSAGE_FILE = os.path.join(SCRIPT_DIR, "message.txt")

DEFAULT_MESSAGE = """Hi {{name}}! 👋

Greetings from *Aditya Enterprises*! 🎆

Check out our new arrivals and special offers today! ⚡

Best regards,
*Aditya Enterprises*"""

def print_banner():
    print("=" * 65)
    print("  🚀 ADITYA ENTERPRISES — FREE WHATSAPP BULK SENDER (TEXT + IMAGE) ")
    print("=" * 65)
    print("  ✓ 100% Free | Photo + Text Caption | Anti-Ban Protected")
    print("=" * 65 + "\n")

def get_sent_numbers():
    if not os.path.exists(SENT_LOG_FILE):
        return set()
    with open(SENT_LOG_FILE, "r", encoding="utf-8") as f:
        return set(line.strip() for line in f if line.strip())

def log_sent_number(phone, name):
    with open(SENT_LOG_FILE, "a", encoding="utf-8") as f:
        f.write(f"{phone}\n")

def log_invalid_number(phone, name, reason="Not on WhatsApp"):
    with open(INVALID_LOG_FILE, "a", encoding="utf-8") as f:
        f.write(f"{phone} - {name} ({reason})\n")

def find_excel_file():
    # 1. Search in SCRIPT_DIR
    candidates = []
    candidates.extend(glob.glob(os.path.join(SCRIPT_DIR, "Bulk_WhatsApp_*.xlsx")))
    candidates.extend(glob.glob(os.path.join(SCRIPT_DIR, "customers_export.xlsx")))
    candidates.extend(glob.glob(os.path.join(SCRIPT_DIR, "*.xlsx")))
    
    # 2. Search in Downloads folder
    if os.path.exists(DOWNLOADS_DIR):
        candidates.extend(glob.glob(os.path.join(DOWNLOADS_DIR, "Bulk_WhatsApp_*.xlsx")))
        candidates.extend(glob.glob(os.path.join(DOWNLOADS_DIR, "customers_export.xlsx")))
    
    # Deduplicate and sort by modification time
    candidates = list(dict.fromkeys(candidates))
    if candidates:
        candidates.sort(key=os.path.getmtime, reverse=True)
        return candidates[0]
    return None

def find_default_image():
    for ext in ["jpeg", "jpg", "png"]:
        candidates = glob.glob(os.path.join(SCRIPT_DIR, f"*.{ext}"))
        if candidates:
            a1 = [c for c in candidates if "A1" in os.path.basename(c)]
            if a1:
                return a1[0]
            return candidates[0]
    return None

def copy_image_to_clipboard(image_path):
    try:
        abs_path = os.path.abspath(image_path).replace("'", "''")
        ps_cmd = f"Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Clipboard]::SetImage([System.Drawing.Image]::FromFile('{abs_path}'))"
        subprocess.run(["powershell", "-NoProfile", "-Command", ps_cmd], capture_output=True, timeout=5)
        return True
    except Exception as e:
        print(f"  [Clipboard copy error]: {e}")
        return False

def clean_phone(phone_val):
    if phone_val is None:
        return ""
    if isinstance(phone_val, float):
        phone_val = int(phone_val)
    val_str = str(phone_val).strip()
    if "." in val_str:
        val_str = val_str.split(".")[0]
        
    raw = "".join(filter(str.isdigit, val_str))
    if len(raw) == 10:
        return "91" + raw
    if len(raw) == 11 and raw.startswith("0"):
        return "91" + raw[1:]
    if len(raw) == 12 and raw.startswith("91"):
        return raw
    return raw

def load_contacts(excel_path):
    wb = openpyxl.load_workbook(excel_path)
    sheet = wb.active
    
    headers = [str(cell.value).strip().lower() if cell.value else "" for cell in sheet[1]]
    
    phone_col = None
    name_col = None
    msg_col = None
    
    for idx, h in enumerate(headers):
        if any(k in h for k in ["phone", "mobile", "number", "contact", "whatsapp"]):
            phone_col = idx
        elif any(k in h for k in ["name", "customer", "client", "party"]):
            name_col = idx
        elif any(k in h for k in ["message", "msg", "text", "template"]):
            msg_col = idx
            
    if phone_col is None:
        phone_col = 1
    
    contacts = []
    for row in sheet.iter_rows(min_row=2, values_only=True):
        if not row or len(row) <= phone_col or not row[phone_col]:
            continue
        
        phone = clean_phone(row[phone_col])
        if len(phone) < 10:
            continue
            
        name = str(row[name_col]).strip() if name_col is not None and len(row) > name_col and row[name_col] else "Dear Customer"
        msg = str(row[msg_col]).strip() if msg_col is not None and len(row) > msg_col and row[msg_col] else ""
        
        contacts.append({
            "phone": phone,
            "name": name,
            "message": msg
        })
        
    return contacts

def get_custom_template():
    if os.path.exists(MESSAGE_FILE):
        try:
            with open(MESSAGE_FILE, "r", encoding="utf-8") as f:
                content = f.read().strip()
                if content:
                    return content
        except Exception:
            pass
    # Create default file
    with open(MESSAGE_FILE, "w", encoding="utf-8") as f:
        f.write(DEFAULT_MESSAGE)
    return DEFAULT_MESSAGE

def setup_driver():
    print("[*] Chrome browser start ho raha hai...")
    options = Options()
    options.add_argument(f"--user-data-dir={CHROME_PROFILE_DIR}")
    options.add_argument("--no-first-run")
    options.add_argument("--no-default-browser-check")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)

    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)
    driver.maximize_window()
    return driver

def wait_for_whatsapp_login(driver):
    driver.get("https://web.whatsapp.com")
    print("\n" + "=" * 65)
    print("📱 AGAR FIRST TIME HAI: Mobile se WhatsApp Web QR code scan karein.")
    print("   (Session auto-save ho jayegi, agli baar scan nahi maangega)")
    print("=" * 65 + "\n")
    
    while True:
        try:
            if driver.find_elements(By.CSS_SELECTOR, "#pane-side") or driver.find_elements(By.CSS_SELECTOR, "div[contenteditable='true']"):
                print("✅ WhatsApp Web Logged In Successfully!\n")
                break
        except Exception:
            pass
        time.sleep(2)

def send_to_contact(driver, contact, image_path=None, template=None):
    phone = contact["phone"]
    name = contact["name"]
    
    # 1. Prepare message text
    if contact.get("message") and len(contact["message"]) > 5:
        msg_text = contact["message"]
    else:
        tmpl = template if template else DEFAULT_MESSAGE
        msg_text = tmpl.replace("{{name}}", name).replace("{{shop}}", "Aditya Enterprises")

    # 2. Open chat URL
    url = f"https://web.whatsapp.com/send?phone={phone}"
    driver.get(url)
    
    # 3. Wait for chat or invalid number popup
    chat_ready = False
    chat_box = None
    for _ in range(25):
        time.sleep(1)
        
        # Check invalid popup
        try:
            popups = driver.find_elements(By.XPATH, "//div[contains(text(), 'invalid') or contains(text(), 'phone number') or contains(text(), 'not on WhatsApp')]")
            if popups:
                ok_btns = driver.find_elements(By.XPATH, "//div[@role='button'][contains(., 'OK') or contains(., 'Ok')] | //button[contains(., 'OK') or contains(., 'Ok')]")
                if ok_btns:
                    driver.execute_script("arguments[0].click();", ok_btns[0])
                log_invalid_number(phone, name, "Not on WhatsApp")
                print(f"  ⚠️  +{phone} ({name}): Number WhatsApp par nahi hai. Skipping.")
                return False
        except Exception:
            pass
            
        # Check chat box
        try:
            boxes = driver.find_elements(By.XPATH, "//footer//div[@contenteditable='true']")
            if boxes:
                chat_box = boxes[0]
                chat_ready = True
                break
        except Exception:
            pass
            
    if not chat_ready or not chat_box:
        print(f"  ❌ +{phone} ({name}): Chat load nahi hua. Skipping.")
        return False
        
    time.sleep(1.2)
    
    # ==========================================
    # CASE 1: SEND IMAGE + CAPTION
    # ==========================================
    if image_path and os.path.exists(image_path):
        image_attached = False
        
        # --- ATTEMPT A: CLIPBOARD PASTE (FASTEST & MOST RELIABLE) ---
        try:
            copy_image_to_clipboard(image_path)
            chat_box.click()
            time.sleep(0.3)
            chat_box.send_keys(Keys.CONTROL, "v")
            
            # Wait for media preview drawer to appear
            for _ in range(8):
                time.sleep(0.6)
                if driver.find_elements(By.XPATH, "//span[@data-icon='send' or @data-icon='send-light'] | //div[@aria-label='Send']"):
                    image_attached = True
                    break
        except Exception as e:
            print(f"  [Clipboard paste note]: {e}")
            
        # --- ATTEMPT B: ATTACH BUTTON + FILE INPUT FALLBACK ---
        if not image_attached:
            try:
                # Find and click attach button via JS
                attach_btns = driver.find_elements(By.XPATH, "//button[@title='Attach' or @aria-label='Attach'] | //div[@title='Attach' or @aria-label='Attach'] | //span[@data-icon='plus' or @data-icon='clip']/ancestor::*[@role='button' or self::button]")
                if attach_btns:
                    driver.execute_script("arguments[0].click();", attach_btns[0])
                    time.sleep(1.2)
                    
                file_inputs = driver.find_elements(By.XPATH, "//input[@type='file']")
                if file_inputs:
                    file_inputs[0].send_keys(os.path.abspath(image_path))
                    time.sleep(2.5)
                    if driver.find_elements(By.XPATH, "//span[@data-icon='send' or @data-icon='send-light'] | //div[@aria-label='Send']"):
                        image_attached = True
            except Exception as e:
                print(f"  [File input note]: {e}")
                
        # If image preview is open, enter caption and click send
        if image_attached:
            try:
                # Find caption box
                caption_selectors = [
                    "//div[contains(@class, 'media-editor') or @role='region']//div[@contenteditable='true']",
                    "//div[@contenteditable='true' and (contains(@aria-placeholder, 'caption') or contains(@aria-label, 'caption') or @data-tab='10')]",
                    "//footer//div[@contenteditable='true']"
                ]
                caption_box = None
                for c_sel in caption_selectors:
                    c_found = driver.find_elements(By.XPATH, c_sel)
                    if c_found:
                        caption_box = c_found[0]
                        break
                        
                if caption_box:
                    caption_box.click()
                    time.sleep(0.3)
                    pyperclip.copy(msg_text)
                    caption_box.send_keys(Keys.CONTROL, "v")
                    time.sleep(0.5)
                    
                # Click send
                send_btns = driver.find_elements(By.XPATH, "//span[@data-icon='send' or @data-icon='send-light']/ancestor::*[@role='button' or self::button] | //div[@aria-label='Send'] | //button[@aria-label='Send']")
                if send_btns:
                    driver.execute_script("arguments[0].click();", send_btns[0])
                else:
                    caption_box.send_keys(Keys.ENTER)
                    
                time.sleep(3.5)
                log_sent_number(phone, name)
                print(f"  ✅ Sent PHOTO + CUSTOM TEXT to {name} (+{phone})")
                return True
            except Exception as e:
                print(f"  ⚠️ Caption/send issue: {e}")
        else:
            print("  ⚠️ Photo attach nahi hua, text bhej rahe hain...")

    # ==========================================
    # CASE 2: TEXT ONLY (OR FALLBACK)
    # ==========================================
    try:
        chat_box.click()
        time.sleep(0.3)
        pyperclip.copy(msg_text)
        chat_box.send_keys(Keys.CONTROL, "v")
        time.sleep(0.5)
        
        send_btns = driver.find_elements(By.XPATH, "//span[@data-icon='send']/ancestor::button | //button[@aria-label='Send']")
        if send_btns:
            driver.execute_script("arguments[0].click();", send_btns[0])
        else:
            chat_box.send_keys(Keys.ENTER)
            
        time.sleep(2.5)
        log_sent_number(phone, name)
        print(f"  ✅ Sent TEXT to {name} (+{phone})")
        return True
    except Exception as e:
        print(f"  ❌ Send failed for {phone}: {e}")
        return False

def main():
    print_banner()
    
    # 1. Custom Message Preview & Edit
    template = get_custom_template()
    sample_preview = template.replace("{{name}}", "Rahul Sharma").replace("{{shop}}", "Aditya Enterprises")
    
    print("📝 AAPKA BROADCAST MESSAGE (Preview):")
    print("-" * 55)
    print(sample_preview)
    print("-" * 55)
    print("💡 Tip: Message change karne ke liye 'message.txt' file Notepad mein edit karein.")
    opt = input("   Press Enter to use this message (or type 'e' to edit now): ").strip()
    if opt.lower() == 'e':
        print("\nType/Paste your new message below. Type 'DONE' on a new line when finished:")
        lines = []
        while True:
            line = input()
            if line.strip() == 'DONE':
                break
            lines.append(line)
        if lines:
            template = "\n".join(lines)
            with open(MESSAGE_FILE, "w", encoding="utf-8") as f:
                f.write(template)
            print("✅ Message saved to 'message.txt'!\n")
            
    # 2. Excel Detection
    excel_path = find_excel_file()
    if excel_path:
        print(f"\n📁 Excel file detected: {os.path.basename(excel_path)}")
        ans = input("   Use this file? (Press Enter for Yes / or type file path): ").strip()
        if ans:
            excel_path = ans
    else:
        excel_path = input("\n📁 Enter Excel file path: ").strip()
        
    if not os.path.exists(excel_path):
        print(f"❌ Error: File '{excel_path}' nahi mila!")
        input("\nPress Enter to exit...")
        return
        
    contacts = load_contacts(excel_path)
    print(f"📊 Total contacts in Excel: {len(contacts)}")
    
    # 3. Sent Log Check & Option to Reset
    sent_numbers = get_sent_numbers()
    if sent_numbers:
        print(f"✓ Already sent: {len(sent_numbers)} contacts")
        ans = input("   Press Enter to continue (skip already sent) OR type 'r' to RESET log and start fresh: ").strip()
        if ans.lower() == 'r':
            if os.path.exists(SENT_LOG_FILE):
                os.remove(SENT_LOG_FILE)
            sent_numbers = set()
            print("🔄 Sent log reset! Starting fresh for all contacts.")
            
    remaining = [c for c in contacts if c["phone"] not in sent_numbers]
    print(f"⚡ Remaining to send: {len(remaining)}")
    
    if not remaining:
        print("\n🎉 Sabhi contacts ko already send kiya ja chuka hai!")
        input("\nPress Enter to exit...")
        return
        
    # 4. Image Detection
    default_img = find_default_image()
    if default_img:
        print(f"\n🖼️ Photo/Poster detected: {os.path.basename(default_img)}")
        ans = input("   Send this photo with messages? (Press Enter for Yes / type path / 'n' for Text only): ").strip()
        if ans.lower() == 'n':
            image_path = None
        elif ans:
            image_path = ans
        else:
            image_path = default_img
    else:
        ans = input("\n🖼️ Enter image path (e.g. A1.jpeg) or press Enter for Text only: ").strip()
        image_path = ans if ans and os.path.exists(ans) else None
        
    if image_path:
        print(f"   ✓ Attachment: {os.path.abspath(image_path)}")
    else:
        print("   ✓ Mode: Text Only")
        
    # 5. Anti-ban Info
    print("\n" + "-" * 65)
    print("🛡️ ANTI-BAN SAFETY CONTROLS ACTIVE:")
    print("   - Delay: 10 to 18 seconds random gap.")
    print("   - Batch Rest: Har 50 messages ke baad 2 minute pause.")
    print("   - Stop Anytime: Ctrl+C dabakar kabhi bhi rok sakte hain.")
    print("-" * 65 + "\n")
    
    confirm = input("👉 Ready to start broadcast? (y/n): ").strip().lower()
    if confirm != 'y':
        print("Cancelled.")
        return
        
    driver = setup_driver()
    try:
        wait_for_whatsapp_login(driver)
        
        sent_count = 0
        for idx, contact in enumerate(remaining, 1):
            print(f"\n[{idx}/{len(remaining)}] Processing: {contact['name']} (+{contact['phone']})")
            
            success = send_to_contact(driver, contact, image_path=image_path, template=template)
            if success:
                sent_count += 1
                
            if sent_count > 0 and sent_count % 50 == 0:
                print("\n" + "=" * 60)
                print("☕ 50 Messages Sent! Anti-Ban break: 2 minute ka aaram le rahe hain...")
                print("=" * 60)
                time.sleep(120)
            else:
                delay = random.uniform(10.0, 18.0)
                print(f"   ⏳ Waiting {delay:.1f}s before next message...")
                time.sleep(delay)
                
        print("\n" + "=" * 65)
        print(f"🎉 BROADCAST COMPLETED! Total {sent_count} messages sent successfully.")
        print("=" * 65)
        
    except KeyboardInterrupt:
        print("\n\n⏸️ Broadcast paused by user. Progress saved in 'sent_log.txt'.")
    finally:
        input("\nPress Enter to close browser...")
        try:
            driver.quit()
        except Exception:
            pass

if __name__ == "__main__":
    main()
