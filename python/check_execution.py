import os
import socket
import threading
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE_DIR = Path(__file__).resolve().parent.parent
SCREENSHOT_DIR = (BASE_DIR /"error_screenshots").resolve()
    # Path("./error_screenshots"))

WEBSITE_FOLDERS = [
     (BASE_DIR / "../data/Galaxy").resolve()
]

TIMEOUT = 1000

def find_free_port() -> int:
    """Finds an unused network port dynamically."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('', 0))
        return s.getsockname()[1]



def check_website(url: str, page, folder_path):
    errors = []

    def handle_js_errors(err):
        errors.append(f"[JS Exception] {err}\n\t\tStack trace:\n\t\t{err.stack}")

    def handle_network_errors(req):
        errors.append(
            f"[Failed Request] {req.url} - {req.failure.error_text if req.failure else 'Failed'}")

    # Listen for runtime exceptions
    page.on("pageerror", handle_js_errors)

    # Listen for console errors (e.g., 404 network failures, explicitly logged errors)
    page.on("console", lambda msg: errors.append(f"[Console Error] {msg.text}: {msg.location.get('url')}") if msg.type == "error" else None)
    # | {msg.args}

    # Listen for failed network requests (e.g., missing JS or CSS files)
    page.on("requestfailed", handle_network_errors)

    try:
        page.goto(url, wait_until="networkidle")

        page.wait_for_timeout(TIMEOUT)

        if errors:
            print(f"❌ Found {len(errors)} issue(s):")
            for err in errors:
                print(f"   - {err}")
            take_screenshot(folder_path, page)
        else:
            print("\t\t✅ No errors detected.")

    except Exception as e:
        print(f"\t\t❌ Load error: {e}")


def take_screenshot(folder_path, page):
    SCREENSHOT_DIR.mkdir(exist_ok=True)
    screenshot_path = SCREENSHOT_DIR / f"{folder_path.name}_error.png"
    page.screenshot(path=str(screenshot_path), full_page=True)
    print(f"📸 Saved screenshot: {screenshot_path}")


def run_sketch_in_browser(folder_path: Path, headless: bool = False):
    if not folder_path.exists():
        print(f"\n⚠️ Skipping {folder_path}: Path does not exist.")
    else:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=headless)
            port = find_free_port()

            # Start the local server in a separate background thread
            server = HTTPServer(('127.0.0.1', port),
                                lambda *args, **kwargs: SimpleHTTPRequestHandler(*args, directory=str(folder_path),
                                                                                 **kwargs))

            # Suppress default server logging output
            server.RequestHandlerClass.log_message = lambda self, format, *args: None

            server_thread = threading.Thread(target=server.serve_forever, daemon=True)
            server_thread.start()

            target_url = f"http://127.0.0.1:{port}/"
            print(f"\nScanning: {folder_path} via {target_url}")

            # Fresh browser context for isolated execution
            context = browser.new_context()
            page = context.new_page()

            check_website(target_url, page, folder_path)

            context.close()
            server.shutdown()

            browser.close()

def main():
    for folder in WEBSITE_FOLDERS:
        folder_path = Path(folder)
        if not folder_path.exists():
            print(f"\n⚠️ Skipping {folder}: Path does not exist.")
            continue

        run_sketch_in_browser()

if __name__ == "__main__":
    main()