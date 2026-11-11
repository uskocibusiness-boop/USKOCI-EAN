import os
import subprocess
import zipfile

src_apk = "android/app/build/outputs/apk/debug/app-debug.apk"
temp_unaligned = "temp_unaligned.apk"
final_apk = "updated_qa.apk"
hbc_file = "test_bundle.hbc"

sdk_build_tools = r"C:\Users\user\AppData\Local\Android\Sdk\build-tools\35.0.0"
zipalign = os.path.join(sdk_build_tools, "zipalign.exe")
apksigner = os.path.join(sdk_build_tools, "apksigner.bat")
keystore = r"android\app\debug.keystore"

# Map generated temp_assets to APK entries
temp_assets_map = {}
if os.path.exists("temp_assets"):
    for root, dirs, files in os.walk("temp_assets"):
        for f in files:
            full_p = os.path.join(root, f)
            temp_assets_map[f] = full_p

print("1. Creating unaligned APK with new bundle and updated drawables...")
with zipfile.ZipFile(src_apk, "r") as zin:
    with zipfile.ZipFile(temp_unaligned, "w") as zout:
        for item in zin.infolist():
            # Skip old signature files and old bundle
            if item.filename.startswith("META-INF/") and any(item.filename.endswith(ext) for ext in [".SF", ".RSA", ".DSA", ".EC"]):
                continue
            if item.filename == "assets/index.android.bundle":
                continue
            
            # Check if this item filename exists in temp_assets
            base_name = os.path.basename(item.filename)
            if base_name in temp_assets_map and ("bell" in base_name or "remote" in base_name or "users" in base_name or "rounded" in base_name):
                src_file = temp_assets_map[base_name]
                print(f"  -> Replacing APK asset: {item.filename} from {src_file}")
                with open(src_file, "rb") as sf:
                    zout.writestr(item, sf.read())
            else:
                zout.writestr(item, zin.read(item.filename))
        
        # Add new bundle
        with open(hbc_file, "rb") as f:
            zout.writestr("assets/index.android.bundle", f.read())

print("2. Zipalign...")
if os.path.exists(final_apk):
    os.remove(final_apk)
subprocess.check_call([zipalign, "-p", "-f", "4", temp_unaligned, final_apk])
os.remove(temp_unaligned)

print("3. Signing with debug key...")
sign_cmd = [
    apksigner, "sign",
    "--ks", keystore,
    "--ks-pass", "pass:android",
    "--key-pass", "pass:android",
    "--ks-key-alias", "androiddebugkey",
    final_apk
]
subprocess.check_call(sign_cmd, shell=True)

print("4. Checking connected ADB devices...")
try:
    dev_out = subprocess.check_output(["adb", "devices"]).decode()
    devices = [line.split()[0] for line in dev_out.strip().splitlines()[1:] if "\tdevice" in line]
    if devices:
        print(f"  Found device(s): {devices}. Installing to {devices[0]}...")
        subprocess.check_call(["adb", "-s", devices[0], "install", "-r", final_apk])
        print("5. Launching app...")
        subprocess.check_call(["adb", "-s", devices[0], "shell", "monkey", "-p", "rs.uskoci.preview", "-c", "android.intent.category.LAUNCHER", "1"])
        print("ALL DONE SUCCESSFULLY AND LAUNCHED ON DEVICE!")
    else:
        print("  No ADB devices currently attached. APK built, aligned, and signed at: " + final_apk)
except Exception as e:
    print("  ADB install skipped or failed: " + str(e))
