#!/usr/bin/env python3
"""
TL Linux - Time Lord Operating System
Main launcher and system coordinator
"""

import sys
import os
from pathlib import Path
import subprocess

# Add subdirectories to path
BASE_DIR = Path(__file__).parent
sys.path.insert(0, str(BASE_DIR))

def check_first_run():
    """Check if this is the first run"""
    config_dir = Path.home() / '.config' / 'tl-linux'
    user_profile = config_dir / 'user_profile.json'
    return not user_profile.exists()

def run_boot_animation():
    """Run boot animation"""
    print("Starting TL Linux boot sequence...")
    try:
        from boot.cephalopod_animation import run_boot_animation
        run_boot_animation(duration=3)
    except Exception as e:
        print(f"Boot animation error: {e}")

def run_onboarding():
    """Run onboarding process"""
    try:
        from onboarding.onboarding_system import OnboardingSystem
        onboarding = OnboardingSystem()
        profile = onboarding.run_onboarding()
        return profile
    except Exception as e:
        print(f"Onboarding error: {e}")
        return None

def run_desktop():
    """Run desktop environment"""
    try:
        from desktop.desktop_environment import TLDesktopEnvironment
        desktop = TLDesktopEnvironment()
        desktop.run()
    except Exception as e:
        print(f"Desktop error: {e}")
        print("\nFalling back to basic mode...")
        show_menu()

def show_menu():
    """Show main menu"""
    while True:
        print("\n" + "=" * 60)
        print("  TL Linux - Time Lord Operating System")
        print("=" * 60)
        print("\n  Main Menu:")
        print("    1. 🖥️  Launch Desktop Environment")
        print("    2. 💻 Launch TL IDE")
        print("    3. 🧮 Calculator")
        print("    4. 📅 Calendar")
        print("    5. 🎮 Emulator Hub")
        print("    6. ⚙️  Settings")
        print("    7. 🔄 Run Onboarding Again")
        print("    8. 🎨 Theme Preview")
        print("    9. 📦 Install Compatibility Tools")
        print("   10. ✨ Spark App")
        print("    0. 🚪 Exit")
        print("\n" + "=" * 60)

        choice = input("\n  Select option: ").strip()

        if choice == '1':
            run_desktop()
        elif choice == '2':
            launch_app('apps/tl_ide.py')
        elif choice == '3':
            launch_app('apps/calculator.py')
        elif choice == '4':
            launch_app('apps/calendar.py')
        elif choice == '5':
            launch_app('apps/emulator_hub.py')
        elif choice == '6':
            launch_app('settings/settings_manager.py')
        elif choice == '7':
            run_onboarding()
        elif choice == '8':
            show_themes()
        elif choice == '9':
            install_compatibility()
        elif choice == '10':
            launch_app('apps/spark_app.py')
        elif choice == '0':
            print("\n  👋 Thanks for using TL Linux!\n")
            sys.exit(0)
        else:
            print("\n  ❌ Invalid option")

def launch_app(app_path):
    """Launch an application"""
    full_path = BASE_DIR / app_path
    if full_path.exists():
        try:
            subprocess.run([sys.executable, str(full_path)])
        except KeyboardInterrupt:
            print("\n  App closed")
        except Exception as e:
            print(f"\n  Error launching app: {e}")
    else:
        print(f"\n  ❌ App not found: {app_path}")

def show_themes():
    """Show theme preview"""
    try:
        from themes.theme_engine import ThemeEngine
        engine = ThemeEngine()

        print("\n" + "=" * 60)
        print("  TL Linux Themes")
        print("=" * 60)

        for theme_name in engine.get_available_themes():
            theme = engine.themes[theme_name]
            print(f"\n  🎨 {theme['name'].upper()}")
            print(f"     Primary: {theme['colors']['primary']}")
            print(f"     Secondary: {theme['colors']['secondary']}")
            print(f"     Background: {theme['colors']['background']}")
            print(f"     Description: {theme['name']} theme")

        input("\n  Press ENTER to continue...")

    except Exception as e:
        print(f"  Error loading themes: {e}")

def install_compatibility():
    """Install compatibility tools"""
    try:
        from compat.compatibility_layer import CompatibilityLayer
        compat = CompatibilityLayer()

        print("\n" + "=" * 60)
        print("  Installing Compatibility Layers")
        print("=" * 60)

        compat.setup_all_compatibility()

        input("\n  Press ENTER to continue...")

    except Exception as e:
        print(f"  Error: {e}")

def main():
    """Main entry point"""
    # Clear screen
    os.system('clear')

    # Run boot animation
    run_boot_animation()

    # Check if first run
    if check_first_run():
        print("\n  Welcome to TL Linux!")
        print("  Let's get you set up...\n")
        run_onboarding()

    # Launch desktop or menu
    if '--menu' in sys.argv:
        show_menu()
    else:
        try:
            run_desktop()
        except KeyboardInterrupt:
            print("\n\n  Exiting TL Linux...\n")
        except Exception as e:
            print(f"\n  Error: {e}")
            print("\n  Starting menu mode...\n")
            show_menu()

if __name__ == '__main__':
    main()
