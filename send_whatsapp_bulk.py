"""
=============================================================================
🛡️ ADITYA ENTERPRISES — 100% FREE WHATSAPP BULK SENDER (TEXT + IMAGE)
=============================================================================
Features:
- 100% Free: No API keys, no monthly fees, no message limits.
- Supports TEXT + PHOTO/POSTER with captions and full emoji support.
- Anti-Ban Protection: Humanized random delay (10-18s) + Batch resting.
- Auto-Resume: Saves progress in 'sent_log.txt'. Never sends twice to same number.
- Persistent Session: Scans QR code only ONCE. Saves session in local folder.
- Emoji Safe: Uses clipboard simulation so emojis (👋, 🎆, ⚡) never fail.
=============================================================================
"""

import os
import sys
import time
import random
import glob
import openpyxl
import pyperclip

# Force UTF-8 output on Windows console to prevent UnicodeEncodeError with emojis
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
SENT_LOG_FILE = os.path.join(SCRIPT_DIR, "sent_log.txt")
INVALID_LOG_FILE = os.path.join(SCRIPT_DIR, "invalid_numbers.txt")
CHROME_PROFILE_DIR = os.path.join(SCRIPT_DIR, ".wa_chrome_profile")

def print_banner():
    print("=" * 65)
    print("  🚀 ADITYA ENTERPRISES — FREE WHATSAPP BULK SENDER (TEXT + IMAGE) ")
    print("=" * 65)
    print("  ✓ 100% Free | Unlimited Contacts | Anti-Ban Safe Delay")
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
    xlsx_files = glob.glob(os.path.join(SCRIPT_DIR, "Bulk_WhatsApp_*.xlsx"))
    if not xlsx_files:
        xlsx_files = glob.glob(os.path.join(SCRIPT_DIR, "customers_export.xlsx"))
    if not xlsx_files:
        xlsx_files = glob.glob(os.path.join(SCRIPT_DIR, "*.xlsx"))
    
    if xlsx_files:
        xlsx_files.sort(key=os.path.getmtime, reverse=True)
        return xlsx_files[0]
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
            
        name = str(row[name_col]).strip() if name_col is not None and len(row) > name_col and row[name_col] else "Customer"
        msg = str(row[msg_col]).strip() if msg_col is not None and len(row) > msg_col and row[msg_col] else ""
        
        contacts.append({
            "phone": phone,
            "name": name,
            "message": msg
        })
        
    return contacts

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
    print("   (Session auto-save ho jayegi, agli baar scan nahi karna padega)")
    print("=" * 65 + "\n")
    
    while True:
        try:
            if driver.find_elements(By.CSS_SELECTOR, "#pane-side") or driver.find_elements(By.CSS_SELECTOR, "div[contenteditable='true']"):
                print("✅ WhatsApp Web Logged In Successfully!\n")
                break
        except Exception:
            pass
        time.sleep(2)

def send_to_contact(driver, contact, image_path=None, default_template=None):
    phone = contact["phone"]
    name = contact["name"]
    
    # 1. Prepare message text
    if contact.get("message"):
        msg_text = contact["message"]
    elif default_template:
        msg_text = default_template.replace("{{name}}", name)
    else:
        msg_text = f"Namaste {name}! Greetings from Aditya Enterprises."
        
    # Copy message to clipboard for emoji-safe pasting
    pyperclip.copy(msg_text)

    # 2. Open chat URL cleanly
    url = f"https://web.whatsapp.com/send?phone={phone}"
    driver.get(url)
    
    # 3. Wait for chat or invalid number popup
    chat_ready = False
    for _ in range(25): # ~25 seconds max
        time.sleep(1)
        
        # Check for invalid number popup
        try:
            popups = driver.find_elements(By.XPATH, "//div[contains(text(), 'invalid') or contains(text(), 'phone number') or contains(text(), 'not on WhatsApp')]")
            if popups:
                ok_btns = driver.find_elements(By.XPATH, "//div[@role='button'][contains(., 'OK') or contains(., 'Ok')] | //button[contains(., 'OK') or contains(., 'Ok')]")
                if ok_btns:
                    ok_btns[0].click()
                log_invalid_number(phone, name, "Invalid or not on WhatsApp")
                print(f"  ⚠️  +{phone} ({name}): Number WhatsApp par nahi hai. Skipping.")
                return False
        except Exception:
            pass
            
        # Check if chat box loaded
        try:
            chat_inputs = driver.find_elements(By.XPATH, "//footer//div[@contenteditable='true']")
            if chat_inputs:
                chat_ready = True
                break
        except Exception:
            pass
            
    if not chat_ready:
        print(f"  ❌ +{phone} ({name}): Chat load nahi hua (Timeout). Skipping.")
        return False
        
    time.sleep(1.5)
    
    # ==========================================
    # CASE 1: SEND IMAGE + CAPTION
    # ==========================================
    if image_path and os.path.exists(image_path):
        try:
            # Click attach button
            attach_btn = None
            attach_selectors = [
                "//button[@title='Attach' or @aria-label='Attach']",
                "//div[@title='Attach' or @aria-label='Attach']",
                "//span[@data-icon='plus']/ancestor::button",
                "//span[@data-icon='attach-menu-plus']/ancestor::button",
                "//span[@data-icon='plus']/ancestor::div[@role='button']",
                "//span[@data-icon='plus']"
            ]
            for sel in attach_selectors:
                found = driver.find_elements(By.XPATH, sel)
                if found:
                    attach_btn = found[0]
                    break
                    
            if attach_btn:
                attach_btn.click()
                time.sleep(1.2)
                
            # Locate media file input
            file_inputs = driver.find_elements(By.XPATH, "//input[@type='file' and contains(@accept, 'image')]")
            if not file_inputs:
                file_inputs = driver.find_elements(By.XPATH, "//input[@type='file']")
                
            if file_inputs:
                file_inputs[0].send_keys(os.path.abspath(image_path))
                time.sleep(2.5) # Wait for media preview drawer
                
                # Locate caption input in media preview drawer
                caption_selectors = [
                    "//div[contains(@class, 'media-editor') or contains(@class, 'drawer') or @role='region']//div[@contenteditable='true']",
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
                    time.sleep(0.5)
                    # Paste emoji-safe caption from clipboard
                    caption_box.send_keys(Keys.CONTROL, "v")
                    time.sleep(0.8)
                    
                # Click send button in media preview
                send_selectors = [
                    "//span[@data-icon='send']/ancestor::div[@role='button']",
                    "//span[@data-icon='send']/ancestor::button",
                    "//div[@aria-label='Send']",
                    "//button[@aria-label='Send']"
                ]
                sent = False
                for s_sel in send_selectors:
                    s_found = driver.find_elements(By.XPATH, s_sel)
                    if s_found:
                        s_found[0].click()
                        sent = True
                        break
                        
                if not sent and caption_box:
                    caption_box.send_keys(Keys.ENTER)
                    sent = True
                    
                time.sleep(3.5) # Wait for media upload
                log_sent_number(phone, name)
                print(f"  ✅ Sent Photo + Text to {name} (+{phone})")
                return True
        except Exception as e:
            print(f"  ⚠️ Photo attach issue ({e}), sending text instead...")

    # ==========================================
    # CASE 2: TEXT ONLY (OR FALLBACK)
    # ==========================================
    try:
        chat_box = driver.find_element(By.XPATH, "//footer//div[@contenteditable='true']")
        chat_box.click()
        time.sleep(0.4)
        # Paste emoji-safe text from clipboard
        chat_box.send_keys(Keys.CONTROL, "v")
        time.sleep(0.6)
        
        send_btns = driver.find_elements(By.XPATH, "//span[@data-icon='send']/ancestor::button | //button[@aria-label='Send']")
        if send_btns:
            send_btns[0].click()
        else:
            chat_box.send_keys(Keys.ENTER)
            
        time.sleep(2.5)
        log_sent_number(phone, name)
        print(f"  ✅ Sent Text to {name} (+{phone})")
        return True
    except Exception as e:
        print(f"  ❌ Send failed for {phone}: {e}")
        return False

def main():
    print_banner()
    
    # 1. Detect or ask for Excel file
    default_excel = find_excel_file()
    if default_excel:
        print(f"📁 Excel file detected: {os.path.basename(default_excel)}")
        ans = input(f"   Use this file? (Press Enter for Yes / or type file path): ").strip()
        excel_path = ans if ans else default_excel
    else:
        excel_path = input("📁 Enter Excel file path (e.g. Bulk_WhatsApp.xlsx): ").strip()
        
    if not os.path.exists(excel_path):
        print(f"❌ Error: File '{excel_path}' nahi mila!")
        input("\nPress Enter to exit...")
        return
        
    contacts = load_contacts(excel_path)
    print(f"📊 Total contacts in Excel: {len(contacts)}")
    
    # 2. Check sent list
    sent_numbers = get_sent_numbers()
    remaining = [c for c in contacts if c["phone"] not in sent_numbers]
    print(f"✓ Already sent: {len(sent_numbers)}")
    print(f"⚡ Remaining to send: {len(remaining)}")
    
    if not remaining:
        print("\n🎉 Sabhi contacts ko already send kiya ja chuka hai! Kuch bacha nahi hai.")
        input("\nPress Enter to exit...")
        return
        
    # 3. Detect or ask for Image
    default_img = find_default_image()
    if default_img:
        print(f"\n🖼️ Image/Poster detected: {os.path.basename(default_img)}")
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
        
    # 4. Anti-ban Delay Info
    print("\n" + "-" * 65)
    print("🛡️ ANTI-BAN SAFETY CONTROLS ACTIVE:")
    print("   - Delay: 10 to 18 seconds random gap between messages.")
    print("   - Batch Pause: Har 50 messages ke baad 2 minute ka break.")
    print("   - Stop Anytime: Aap Ctrl+C dabakar kabhi bhi rok sakte hain.")
    print("     (Dobara chalane par ye wahin se continue karega)")
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
            
            success = send_to_contact(driver, contact, image_path=image_path)
            if success:
                sent_count += 1
                
            # Batch rest every 50 messages
            if sent_count > 0 and sent_count % 50 == 0:
                print("\n" + "=" * 60)
                print("☕ 50 Messages Sent! Anti-Ban break: 2 minute ka aaram le rahe hain...")
                print("=" * 60)
                time.sleep(120)
            else:
                # Random humanized delay
                delay = random.uniform(10.0, 18.0)
                print(f"   ⏳ Waiting {delay:.1f}s before next message...")
                time.sleep(delay)
                
        print("\n" + "=" * 65)
        print(f"🎉 BROADCAST COMPLETED! Total {sent_count} messages sent successfully.")
        print("=" * 65)
        
    except KeyboardInterrupt:
        print("\n\n⏸️ Broadcast paused by user. Progress saved in 'sent_log.txt'.")
        print("Aap agle session mein dobara start kar sakte hain!")
    finally:
        input("\nPress Enter to close browser...")
        try:
            driver.quit()
        except Exception:
            pass

if __name__ == "__main__":
    main()
