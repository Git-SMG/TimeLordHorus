#!/bin/bash
###############################################################################
# TL Linux ISO Builder
# Creates a bootable ISO image of TL Linux
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TL_VERSION="1.0.0"
TL_CODENAME="Chronos"

# Debian base version: "bookworm" (Debian 12) or "trixie" (Debian 13)
# You can change this to build on different Debian versions
DEBIAN_RELEASE="${DEBIAN_RELEASE:-bookworm}"  # Default to Debian 12

ISO_NAME="tl-linux-${TL_VERSION}-amd64.iso"
BUILD_DIR="$(pwd)/iso-build"
WORK_DIR="${BUILD_DIR}/work"
ISO_DIR="${BUILD_DIR}/iso"
ROOTFS_DIR="${BUILD_DIR}/rootfs"
OUTPUT_DIR="$(pwd)/release"
KERNEL_OUTPUT_DIR="${OUTPUT_DIR}/vmlinuz"

echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     TL Linux ISO Builder v${TL_VERSION}        ║${NC}"
echo -e "${BLUE}║  Building Accessible Linux Distribution   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""

# Check for root privileges
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: This script must be run as root (use sudo)${NC}"
    echo "Reason: ISO creation requires mounting filesystems and chroot operations"
    exit 1
fi

# Check for spaces in current directory path
CURRENT_DIR="$(pwd)"
if [[ "$CURRENT_DIR" =~ [[:space:]] ]]; then
    echo -e "${RED}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  ERROR: Path contains spaces!                             ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}Current directory:${NC} $CURRENT_DIR"
    echo ""
    echo -e "${YELLOW}The build process cannot handle spaces in the path.${NC}"
    echo ""
    echo "Please move the TL Linux directory to a path without spaces:"
    echo ""
    echo "  Good paths:"
    echo "    /home/user/tl-linux"
    echo "    /opt/tl-linux"
    echo "    ~/Projects/tl-linux"
    echo ""
    echo "  Bad paths (contain spaces):"
    echo "    /home/curtis/Desktop/TimeLordHorus-main (1)/tl-linux"
    echo "    ~/My Documents/tl-linux"
    echo ""
    echo "Example fix:"
    echo "  mv \"$CURRENT_DIR\" ~/tl-linux"
    echo "  cd ~/tl-linux"
    echo "  sudo ./build-iso.sh"
    echo ""
    exit 1
fi

# Check dependencies
echo -e "${YELLOW}[1/8]${NC} Checking dependencies..."
REQUIRED_PACKAGES=(
    "debootstrap"
    "squashfs-tools"
    "xorriso"
    "grub-pc-bin"
    "grub-efi-amd64-bin"
    "mtools"
    "dosfstools"
    "syslinux"
    "syslinux-utils"
    "isolinux"
    "syslinux-common"
)

MISSING_PACKAGES=()
for pkg in "${REQUIRED_PACKAGES[@]}"; do
    if ! dpkg -l | grep -q "^ii  $pkg"; then
        MISSING_PACKAGES+=("$pkg")
    fi
done

if [ ${#MISSING_PACKAGES[@]} -gt 0 ]; then
    echo -e "${YELLOW}Installing missing packages: ${MISSING_PACKAGES[*]}${NC}"
    apt-get update
    apt-get install -y "${MISSING_PACKAGES[@]}"
fi
echo -e "${GREEN}✓ All dependencies satisfied${NC}"

# Clean previous build
if [ -d "$BUILD_DIR" ]; then
    echo -e "${YELLOW}[2/8]${NC} Cleaning previous build..."
    umount -lf "${ROOTFS_DIR}/dev" 2>/dev/null || true
    umount -lf "${ROOTFS_DIR}/proc" 2>/dev/null || true
    umount -lf "${ROOTFS_DIR}/sys" 2>/dev/null || true
    umount -lf "${ROOTFS_DIR}/run" 2>/dev/null || true
    rm -rf "$BUILD_DIR"
fi

# Create directory structure
echo -e "${YELLOW}[3/8]${NC} Creating build directories..."
mkdir -p "$BUILD_DIR" "$WORK_DIR" "$ISO_DIR" "$ROOTFS_DIR" "$OUTPUT_DIR" "$KERNEL_OUTPUT_DIR"
echo -e "${GREEN}✓ Directories created${NC}"

# Bootstrap base system
echo -e "${YELLOW}[4/8]${NC} Bootstrapping base Debian system (this may take 10-15 minutes)..."
echo "  Installing minimal Debian base system..."
echo "  Using Debian release: ${DEBIAN_RELEASE}"

# Use debootstrap to create minimal system
debootstrap \
    --arch=amd64 \
    --variant=minbase \
    --include=linux-image-amd64,live-boot,systemd-sysv \
    "$DEBIAN_RELEASE" \
    "$ROOTFS_DIR" \
    http://deb.debian.org/debian/

# Verify debootstrap completed successfully
if [ ! -f "${ROOTFS_DIR}/bin/bash" ]; then
    echo -e "${RED}✗ Debootstrap failed - /bin/bash not found${NC}"
    exit 1
fi

# Verify dynamic linker exists
if [ ! -f "${ROOTFS_DIR}/lib/x86_64-linux-gnu/ld-linux-x86-64.so.2" ] && \
   [ ! -f "${ROOTFS_DIR}/lib64/ld-linux-x86-64.so.2" ]; then
    echo -e "${RED}✗ Dynamic linker missing - debootstrap incomplete${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Base system bootstrapped${NC}"

# Mount necessary filesystems for chroot
echo -e "${YELLOW}[5/8]${NC} Setting up chroot environment..."
mount --bind /dev "${ROOTFS_DIR}/dev"
mount --bind /proc "${ROOTFS_DIR}/proc"
mount --bind /sys "${ROOTFS_DIR}/sys"
mount --bind /run "${ROOTFS_DIR}/run"
echo -e "${GREEN}✓ Chroot environment ready${NC}"

# Configure the system
echo -e "${YELLOW}[6/8]${NC} Configuring TL Linux system..."

# Create configuration script to run inside chroot
cat > "${ROOTFS_DIR}/tmp/configure-system.sh" << 'CHROOT_EOF'
#!/bin/bash
set -e

export DEBIAN_FRONTEND=noninteractive
export HOME=/root
export LC_ALL=C

echo "==> Configuring APT sources"
cat > /etc/apt/sources.list << EOF
deb http://deb.debian.org/debian bookworm main contrib non-free non-free-firmware
deb http://deb.debian.org/debian bookworm-updates main contrib non-free non-free-firmware
deb http://security.debian.org/debian-security bookworm-security main contrib non-free non-free-firmware
EOF

echo "==> Updating package lists"
apt-get update

echo "==> Installing essential packages"
apt-get install -y \
    linux-image-amd64 \
    live-boot \
    systemd-sysv \
    network-manager \
    wireless-tools \
    wpasupplicant \
    curl \
    wget \
    git \
    vim \
    nano \
    sudo \
    locales

echo "==> Installing desktop environment (XFCE - lightweight and accessible)"
apt-get install -y \
    xorg \
    xfce4 \
    xfce4-terminal \
    lightdm \
    lightdm-gtk-greeter \
    dbus-x11 \
    pulseaudio \
    pavucontrol

echo "==> Installing Python and dependencies"
apt-get install -y \
    python3 \
    python3-pip \
    python3-tk \
    python3-pil \
    python3-pil.imagetk

echo "==> Installing TL Linux Python dependencies"
pip3 install --break-system-packages \
    pynput \
    pillow \
    python-xlib

echo "==> Installing firmware packages"
apt-get install -y \
    linux-firmware \
    firmware-linux \
    firmware-linux-free \
    firmware-linux-nonfree \
    firmware-misc-nonfree \
    intel-microcode \
    amd64-microcode \
    firmware-realtek \
    firmware-atheros \
    firmware-iwlwifi \
    firmware-bnx2 \
    firmware-bnx2x \
    firmware-brcm80211 \
    firmware-intelwimax \
    firmware-ipw2x00 \
    firmware-libertas \
    firmware-ralink \
    firmware-ti-connectivity \
    firmware-amd-graphics \
    firmware-nvidia-gsp \
    fwupd \
    fwupd-signed || true

echo "==> Installing accessibility tools"
apt-get install -y \
    orca \
    espeak-ng \
    speech-dispatcher \
    at-spi2-core \
    xdotool \
    wmctrl \
    xclip \
    scrot

echo "==> Installing archive tools"
apt-get install -y \
    zip \
    unzip \
    tar \
    gzip \
    bzip2 \
    xz-utils \
    p7zip-full \
    p7zip-rar

echo "==> Installing media codecs and tools"
apt-get install -y \
    gstreamer1.0-plugins-base \
    gstreamer1.0-plugins-good \
    gstreamer1.0-plugins-bad \
    gstreamer1.0-plugins-ugly \
    gstreamer1.0-libav \
    gstreamer1.0-tools \
    gstreamer1.0-pulseaudio \
    ffmpeg \
    vlc \
    mpv \
    poppler-utils \
    imagemagick \
    gimp || true

echo "==> Installing system utilities"
apt-get install -y \
    htop \
    neofetch \
    tree \
    rsync \
    time \
    file \
    less \
    psmisc \
    ufw \
    gufw \
    gparted \
    timeshift \
    baobab \
    dconf-editor

echo "==> Configuring locale"
echo "en_US.UTF-8 UTF-8" > /etc/locale.gen
locale-gen
update-locale LANG=en_US.UTF-8

echo "==> Setting hostname"
echo "tl-linux" > /etc/hostname

echo "==> Configuring hosts file"
cat > /etc/hosts << EOF
127.0.0.1   localhost
127.0.1.1   tl-linux
::1         localhost ip6-localhost ip6-loopback
EOF

echo "==> Creating default user (tluser)"
useradd -m -s /bin/bash -G sudo,audio,video,plugdev,netdev tluser
echo "tluser:tluser" | chpasswd
echo "root:toor" | chpasswd

echo "==> Configuring sudo"
echo "tluser ALL=(ALL:ALL) NOPASSWD: ALL" > /etc/sudoers.d/tluser
chmod 0440 /etc/sudoers.d/tluser

echo "==> Enabling services"
systemctl enable NetworkManager
systemctl enable lightdm

echo "==> Cleaning up"
apt-get clean
rm -rf /var/lib/apt/lists/*
rm -rf /tmp/*
rm -rf /var/tmp/*

echo "==> System configuration complete"
CHROOT_EOF

chmod +x "${ROOTFS_DIR}/tmp/configure-system.sh"

# Test chroot before running configuration
echo "  Testing chroot environment..."
if ! chroot "$ROOTFS_DIR" /bin/true 2>/dev/null; then
    echo -e "${RED}✗ Chroot test failed!${NC}"
    echo ""
    echo "Common causes:"
    echo "  1. Debootstrap didn't complete properly"
    echo "  2. Missing dynamic linker"
    echo "  3. Architecture mismatch"
    echo ""
    echo "Checking system..."
    echo "  bash exists: $([ -f "${ROOTFS_DIR}/bin/bash" ] && echo 'YES' || echo 'NO')"
    echo "  /lib exists: $([ -d "${ROOTFS_DIR}/lib" ] && echo 'YES' || echo 'NO')"
    echo "  /lib64 exists: $([ -d "${ROOTFS_DIR}/lib64" ] && echo 'YES' || echo 'NO')"

    if [ -d "${ROOTFS_DIR}/lib/x86_64-linux-gnu" ]; then
        echo "  Dynamic linker: $([ -f "${ROOTFS_DIR}/lib/x86_64-linux-gnu/ld-linux-x86-64.so.2" ] && echo 'YES' || echo 'NO')"
    fi

    echo ""
    echo "Try running debootstrap manually to see detailed errors:"
    echo "  sudo debootstrap --arch=amd64 ${DEBIAN_RELEASE} ${ROOTFS_DIR} http://deb.debian.org/debian/"
    exit 1
fi
echo "  Chroot test passed ✓"

# Run configuration in chroot
echo "  Running system configuration..."
if ! chroot "$ROOTFS_DIR" /tmp/configure-system.sh; then
    echo -e "${RED}✗ System configuration failed${NC}"
    echo "Check ${ROOTFS_DIR}/tmp/configure-system.sh for errors"
    exit 1
fi

# Copy TL Linux files
echo "  Installing TL Linux applications..."
cp -r "$(pwd)/apps" "${ROOTFS_DIR}/opt/tl-linux/"
cp -r "$(pwd)/system" "${ROOTFS_DIR}/opt/tl-linux/"
cp -r "$(pwd)/docs" "${ROOTFS_DIR}/opt/tl-linux/" 2>/dev/null || true

# Create desktop entries
mkdir -p "${ROOTFS_DIR}/usr/share/applications"

cat > "${ROOTFS_DIR}/usr/share/applications/tl-linux-hub.desktop" << 'EOF'
[Desktop Entry]
Version=1.0
Type=Application
Name=TL Linux Control Center
Comment=Access all TL Linux features
Exec=python3 /opt/tl-linux/apps/accessibility_hub.py
Icon=preferences-desktop-accessibility
Terminal=false
Categories=Accessibility;Settings;
StartupNotify=true
EOF

# Create welcome message
cat > "${ROOTFS_DIR}/etc/motd" << 'EOF'

╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║  ████████╗██╗         ██╗     ██╗███╗   ██╗██╗   ██╗██╗  ██╗ ║
║  ╚══██╔══╝██║         ██║     ██║████╗  ██║██║   ██║╚██╗██╔╝ ║
║     ██║   ██║         ██║     ██║██╔██╗ ██║██║   ██║ ╚███╔╝  ║
║     ██║   ██║         ██║     ██║██║╚██╗██║██║   ██║ ██╔██╗  ║
║     ██║   ███████╗    ███████╗██║██║ ╚████║╚██████╔╝██╔╝ ██╗ ║
║     ╚═╝   ╚══════╝    ╚══════╝╚═╝╚═╝  ╚═══╝ ╚═════╝ ╚═╝  ╚═╝ ║
║                                                                ║
║              The Accessible Linux Distribution                ║
║                     Version 1.0.0 "Chronos"                   ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝

Welcome to TL Linux - The World's Most Accessible Operating System

Default Login:
  Username: tluser
  Password: tluser

Features:
  • Advanced ADHD & Autism Support
  • Complete Motor Accessibility (Sticky Keys, Mouse Keys)
  • Screen Reader & Magnification
  • AI Voice Control & Troubleshooting
  • Dual A/B Partition System (Never Brick Your System!)
  • Professional Productivity Tools

Quick Start:
  • Press Super (Windows key) to open application menu
  • Launch "TL Linux Control Center" for accessibility settings
  • Terminal: Ctrl+Alt+T
  • File Manager: Available in Applications menu

Documentation: /opt/tl-linux/docs/
Support: https://github.com/TimeLordHorus/TL-Linux

Enjoy your accessible computing experience!

EOF

# Create autostart for TL Linux hub
mkdir -p "${ROOTFS_DIR}/etc/xdg/autostart"
cp "${ROOTFS_DIR}/usr/share/applications/tl-linux-hub.desktop" \
   "${ROOTFS_DIR}/etc/xdg/autostart/"

echo -e "${GREEN}✓ System configured${NC}"

# Unmount chroot filesystems
echo "  Unmounting chroot filesystems..."
umount -lf "${ROOTFS_DIR}/dev"
umount -lf "${ROOTFS_DIR}/proc"
umount -lf "${ROOTFS_DIR}/sys"
umount -lf "${ROOTFS_DIR}/run"

# Create squashfs
echo -e "${YELLOW}[7/8]${NC} Creating compressed filesystem (this may take 5-10 minutes)..."
mkdir -p "${ISO_DIR}/live"
mksquashfs "$ROOTFS_DIR" "${ISO_DIR}/live/filesystem.squashfs" \
    -comp xz \
    -b 1M \
    -Xbcj x86 \
    -e boot

echo -e "${GREEN}✓ Filesystem compressed${NC}"

# Copy kernel and initrd
echo "  Copying kernel and initrd to ISO..."
cp "${ROOTFS_DIR}/boot"/vmlinuz-* "${ISO_DIR}/live/vmlinuz"
cp "${ROOTFS_DIR}/boot"/initrd.img-* "${ISO_DIR}/live/initrd"

echo "  Copying kernel and initrd to output folder..."
cp "${ROOTFS_DIR}/boot"/vmlinuz-* "${KERNEL_OUTPUT_DIR}/vmlinuz"
cp "${ROOTFS_DIR}/boot"/initrd.img-* "${KERNEL_OUTPUT_DIR}/initrd.img"
echo "  ✓ Kernel files available at: ${KERNEL_OUTPUT_DIR}"

# Copy ISOLINUX bootloader files for BIOS
echo "  Copying ISOLINUX bootloader..."
mkdir -p "${ISO_DIR}/isolinux"
if [ -f "/usr/lib/ISOLINUX/isolinux.bin" ]; then
    cp /usr/lib/ISOLINUX/isolinux.bin "${ISO_DIR}/isolinux/"
elif [ -f "/usr/lib/syslinux/isolinux.bin" ]; then
    cp /usr/lib/syslinux/isolinux.bin "${ISO_DIR}/isolinux/"
else
    echo -e "${YELLOW}  Warning: isolinux.bin not found, installing syslinux-utils...${NC}"
    apt-get install -y syslinux-utils isolinux
    cp /usr/lib/ISOLINUX/isolinux.bin "${ISO_DIR}/isolinux/"
fi

# Copy additional ISOLINUX modules
for module in ldlinux.c32 libcom32.c32 libutil.c32 menu.c32 vesamenu.c32; do
    if [ -f "/usr/lib/syslinux/modules/bios/$module" ]; then
        cp "/usr/lib/syslinux/modules/bios/$module" "${ISO_DIR}/isolinux/" 2>/dev/null || true
    elif [ -f "/usr/lib/ISOLINUX/$module" ]; then
        cp "/usr/lib/ISOLINUX/$module" "${ISO_DIR}/isolinux/" 2>/dev/null || true
    fi
done

# Create EFI boot image
echo "  Creating EFI boot image..."
mkdir -p "${ISO_DIR}/boot/grub"
dd if=/dev/zero of="${ISO_DIR}/boot/grub/efi.img" bs=1M count=10 2>/dev/null
mkfs.vfat "${ISO_DIR}/boot/grub/efi.img" >/dev/null 2>&1

# Mount EFI image and populate it
mkdir -p "${WORK_DIR}/efi-mount"
mount -o loop "${ISO_DIR}/boot/grub/efi.img" "${WORK_DIR}/efi-mount"

# Create EFI directory structure
mkdir -p "${WORK_DIR}/efi-mount/EFI/BOOT"

# Install GRUB to EFI image
grub-mkstandalone \
    --format=x86_64-efi \
    --output="${WORK_DIR}/efi-mount/EFI/BOOT/BOOTX64.EFI" \
    --locales="" \
    --fonts="" \
    "boot/grub/grub.cfg=${ISO_DIR}/boot/grub/grub.cfg"

# Unmount EFI image
umount "${WORK_DIR}/efi-mount"

# Create GRUB configuration
echo -e "${YELLOW}[8/8]${NC} Creating bootloader..."
mkdir -p "${ISO_DIR}/boot/grub"

cat > "${ISO_DIR}/boot/grub/grub.cfg" << 'EOF'
set default="0"
set timeout=10

# Load graphics
insmod all_video
insmod gfxterm
insmod png

# Set theme
set gfxmode=auto
terminal_output gfxterm

# Menu colors
set menu_color_normal=white/black
set menu_color_highlight=black/light-blue

menuentry "TL Linux 1.0.0 (Live)" {
    linux /live/vmlinuz boot=live quiet splash components username=tluser
    initrd /live/initrd
}

menuentry "TL Linux 1.0.0 (Live - Accessibility Mode)" {
    linux /live/vmlinuz boot=live quiet splash components username=tluser accessibility=1
    initrd /live/initrd
}

menuentry "TL Linux 1.0.0 (Safe Mode)" {
    linux /live/vmlinuz boot=live nomodeset quiet splash components username=tluser
    initrd /live/initrd
}

menuentry "TL Linux 1.0.0 (Persistent Storage)" {
    linux /live/vmlinuz boot=live persistence quiet splash components username=tluser
    initrd /live/initrd
}

menuentry "Memory Test (memtest86+)" {
    linux16 /boot/memtest86+.bin
}

menuentry "Boot from First Hard Disk" {
    set root=(hd0)
    chainloader +1
}
EOF

# Create isolinux configuration for legacy BIOS
mkdir -p "${ISO_DIR}/isolinux"
cat > "${ISO_DIR}/isolinux/isolinux.cfg" << 'EOF'
UI menu.c32
PROMPT 0
MENU TITLE TL Linux 1.0.0 Boot Menu
TIMEOUT 100

DEFAULT live

LABEL live
  MENU LABEL TL Linux 1.0.0 (Live)
  MENU DEFAULT
  KERNEL /live/vmlinuz
  APPEND initrd=/live/initrd boot=live quiet splash components username=tluser

LABEL accessible
  MENU LABEL TL Linux 1.0.0 (Accessibility Mode)
  KERNEL /live/vmlinuz
  APPEND initrd=/live/initrd boot=live quiet splash components username=tluser accessibility=1

LABEL safe
  MENU LABEL TL Linux 1.0.0 (Safe Mode)
  KERNEL /live/vmlinuz
  APPEND initrd=/live/initrd boot=live nomodeset quiet splash components username=tluser

LABEL persistent
  MENU LABEL TL Linux 1.0.0 (Persistent Storage)
  KERNEL /live/vmlinuz
  APPEND initrd=/live/initrd boot=live persistence quiet splash components username=tluser
EOF

# Generate the ISO
echo "  Creating ISO image..."
xorriso -as mkisofs \
    -iso-level 3 \
    -full-iso9660-filenames \
    -volid "TL_LINUX_1_0" \
    -appid "TL Linux 1.0.0 - The Accessible Linux Distribution" \
    -publisher "TL Linux Project" \
    -preparer "TL Linux ISO Builder" \
    -eltorito-boot isolinux/isolinux.bin \
    -eltorito-catalog isolinux/boot.cat \
    -no-emul-boot \
    -boot-load-size 4 \
    -boot-info-table \
    -isohybrid-mbr /usr/lib/ISOLINUX/isohdpfx.bin \
    -eltorito-alt-boot \
    -e boot/grub/efi.img \
    -no-emul-boot \
    -isohybrid-gpt-basdat \
    -output "${OUTPUT_DIR}/${ISO_NAME}" \
    "${ISO_DIR}" 2>/dev/null || {

    # Fallback simpler ISO creation if xorriso has issues
    echo "  Using fallback ISO creation method..."
    genisoimage \
        -rational-rock \
        -volid "TL_LINUX_1_0" \
        -cache-inodes \
        -joliet \
        -full-iso9660-filenames \
        -b isolinux/isolinux.bin \
        -c isolinux/boot.cat \
        -no-emul-boot \
        -boot-load-size 4 \
        -boot-info-table \
        -output "${OUTPUT_DIR}/${ISO_NAME}" \
        "${ISO_DIR}"
}

echo -e "${GREEN}✓ ISO image created${NC}"

# Calculate checksums
echo ""
echo -e "${YELLOW}Generating checksums...${NC}"
cd "$OUTPUT_DIR"
sha256sum "$ISO_NAME" > "${ISO_NAME}.sha256"
md5sum "$ISO_NAME" > "${ISO_NAME}.md5"

# Get ISO size
ISO_SIZE=$(du -h "$ISO_NAME" | cut -f1)

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          BUILD COMPLETED!                  ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}ISO File:${NC}     ${OUTPUT_DIR}/${ISO_NAME}"
echo -e "${BLUE}Size:${NC}         ${ISO_SIZE}"
echo -e "${BLUE}SHA256:${NC}       $(cat ${ISO_NAME}.sha256 | cut -d' ' -f1)"
echo -e "${BLUE}Kernel:${NC}       ${KERNEL_OUTPUT_DIR}/vmlinuz"
echo -e "${BLUE}Initrd:${NC}       ${KERNEL_OUTPUT_DIR}/initrd.img"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Test the ISO in a virtual machine (VirtualBox, VMware, QEMU)"
echo "  2. Write to USB: sudo dd if=${ISO_NAME} of=/dev/sdX bs=4M status=progress"
echo "  3. Or use: balenaEtcher, Rufus (Windows), or Startup Disk Creator"
echo ""
echo -e "${BLUE}Testing with QEMU:${NC}"
echo "  qemu-system-x86_64 -cdrom ${ISO_NAME} -m 2048 -enable-kvm"
echo ""
echo -e "${GREEN}TL Linux is ready to change lives with accessible computing!${NC}"
echo ""
