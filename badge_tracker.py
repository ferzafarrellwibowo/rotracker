import os
import requests
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from datetime import datetime
from time import sleep

API_KEY = os.environ.get("ROBLOX_OPEN_CLOUD_API_KEY", "YOUR_API_KEY_HERE")
OPEN_CLOUD_BASE = "https://apis.roblox.com/cloud/v2"
OPEN_CLOUD_HEADERS = {"x-api-key": API_KEY}

PRINT_PROGRESS = True
BATCH_PER_PRINT = 500


def get_user_id_from_username(username: str) -> str:
    url = "https://users.roblox.com/v1/usernames/users"
    response = requests.post(url, json={"usernames": [username]})
    data = response.json()
    if response.status_code == 200 and data.get("data"):
        return str(data["data"][0]["id"])
    raise Exception(f"Tidak dapat menemukan User ID untuk username: '{username}'")


def check_can_view_inventory(user_id: str) -> bool:
    url = f"{OPEN_CLOUD_BASE}/users/{user_id}/inventory-items"
    params = {"filter": "badges=true", "maxPageSize": 1}
    response = requests.get(url, headers=OPEN_CLOUD_HEADERS, params=params)
    if response.status_code == 403:
        return False
    if response.status_code == 200:
        return True
    response.raise_for_status()
    return False


def fetch_badges_open_cloud(user_id: str) -> list[dict]:
    url = f"{OPEN_CLOUD_BASE}/users/{user_id}/inventory-items"
    params = {
        "filter": "badges=true",
        "maxPageSize": 100,
    }
    badges = []
    page_token = None

    while True:
        if page_token:
            params["pageToken"] = page_token

        response = requests.get(url, headers=OPEN_CLOUD_HEADERS, params=params)

        retry_after = 3
        while response.status_code == 429:
            print(f"Rate limited (429). Menunggu {retry_after} detik...")
            sleep(retry_after)
            response = requests.get(url, headers=OPEN_CLOUD_HEADERS, params=params)
            retry_after += 3

        response.raise_for_status()
        data = response.json()

        for item in data.get("inventoryItems", []):
            badges.append(item)
            if PRINT_PROGRESS and len(badges) % BATCH_PER_PRINT == 0:
                print(f"Berhasil mengambil {len(badges)} badges...")

        page_token = data.get("nextPageToken")
        if not page_token:
            break

    return badges


def convert_date_to_datetime(date: str) -> datetime:
    if "." in date:
        base, frac = date.rstrip("Z").split(".", 1)
        frac = (frac + "000")[:3]
        date = f"{base}.{frac}Z"
    else:
        date = date.rstrip("Z") + ".000Z"

    return datetime.strptime(date, "%Y-%m-%dT%H:%M:%S.%fZ")


def fetch_official_badges_count(user_id: str) -> int:
    try:
        url = f"https://accountinformation.roblox.com/v1/users/{user_id}/roblox-badges"
        res = requests.get(url, timeout=10)
        if res.status_code == 200:
            data = res.json()
            return len(data) if isinstance(data, list) else 0
    except Exception:
        pass
    return 0


def plot_cumulative_badges(username: str, user_id: str, dates: list[str], official_count: int = 0):
    parsed = sorted(convert_date_to_datetime(d) for d in dates)
    cumulative_counts = list(range(1, len(parsed) + 1))
    total_count = len(parsed) + official_count

    plt.style.use("dark_background")
    fig, ax = plt.subplots(figsize=(10, 6))

    ax.scatter(parsed, cumulative_counts, marker="o", color="#38bdf8", alpha=0.35, s=15)
    ax.set_xlabel("Tanggal Badge Diperoleh", fontsize=11, labelpad=10)
    ax.set_ylabel("Total Akumulasi Player Badges", fontsize=11, labelpad=10)
    ax.set_title(f"Perkembangan Badge untuk {username} ({user_id})", fontsize=13, pad=15)
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y"))
    ax.xaxis.set_major_locator(mdates.YearLocator())

    info_lines = [f"Total Badges: {total_count:,}", f"Player Badges: {len(parsed):,}"]
    if official_count > 0:
        info_lines.append(f"Official Badges: {official_count:,}")

    ax.text(
        0.04, 0.94,
        "\n".join(info_lines),
        ha="left", va="top", color="white",
        transform=ax.transAxes,
        fontsize=11,
        bbox=dict(boxstyle="square,pad=0.5", fc="#18181b", ec="#3f3f46")
    )

    plt.grid(True, linestyle="--", alpha=0.2)
    plt.tight_layout()
    plt.show()


def process_user(username: str):
    username = username.strip()
    if not username:
        return

    print(f"\n[+] Mencari data user: {username}...")
    try:
        user_id = get_user_id_from_username(username)
    except Exception as e:
        print(f"[-] Error: {e}")
        return

    print(f"[+] User ID ditemukan: {user_id}")
    print("[+] Memeriksa izin inventaris...")

    can_view = check_can_view_inventory(user_id)
    if not can_view:
        print(f"[-] Inventaris {username} bersifat PRIVATE.")
        print("[-] Badge tidak dapat diakses jika pengaturan inventaris disembunyikan.")
        return

    print("[+] Inventaris PUBLIK. Mengambil riwayat badges...")
    official_count = fetch_official_badges_count(user_id)
    badges = fetch_badges_open_cloud(user_id)
    dates = [item["addTime"] for item in badges if "addTime" in item]

    if not dates and official_count == 0:
        print(f"[-] Tidak ada badge yang ditemukan untuk {username}.")
        return

    total_count = len(dates) + official_count
    print(f"[✓] Berhasil: Total {total_count:,} badge (Player: {len(dates):,}, Official: {official_count:,}).")
    print("[+] Menampilkan grafik...")
    plot_cumulative_badges(username, user_id, dates, official_count=official_count)


def main():
    while True:
        username = input("\nMasukkan Roblox Username (atau ketik 'exit' untuk keluar): ").strip()
        if not username or username.lower() in ("exit", "quit", "q"):
            print("Keluar.")
            break
        process_user(username)


if __name__ == "__main__":
    main()
