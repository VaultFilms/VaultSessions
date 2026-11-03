<p align="center"><img src="../VaultSessions/icons/leaf-128.png" width="64" height="64" alt="VaultSessions"></p>
<h1 align="center">VaultSessions</h1>

<h3 align="center">Satukan asisten AI Anda sendiri.</h3>

<p align="center">
  <a href="../README.md">English</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.fr.md">Français</a> |
  <a href="README.de.md">Deutsch</a> |
  <a href="README.es.md">Español</a> |
  <a href="README.it.md">Italiano</a> |
  <a href="README.id.md">Indonesia</a> |
  <a href="README.pt-BR.md">Português</a> |
  <a href="README.hi.md">हिन्दी</a>
</p>

<p align="center">
  <a href="https://www.youtube.com/watch?v=89KXgu_0Fm8">
    <img src="introduction-compact.gif" alt="VaultSessions Demo" width="700">
  </a>
</p>

**Aplikasi rapat sumber terbuka tempat manusia dan asisten AI pribadi mereka — ChatGPT, Gemini, dan Claude — dapat berpikir dan berkolaborasi bersama dengan memanfaatkan personalisasi yang sudah ada.**

## Fitur

- **Bawa kepribadian AI Anda sendiri.** Hubungkan chat web resmi yang biasa Anda gunakan, beserta percakapan dan personalisasi yang sudah ada. Tidak memerlukan kunci API AI.
- **Diskusi kelompok yang alami.** AI yang terhubung berbicara bergiliran, memberi sudut pandang baru, dan melewati giliran jika tidak ada tambahan. Jika hanya satu AI terhubung, AI tersebut menjawab sekali.
- **Pilih penjawab pertama secara alami.** Gunakan `@GPT`, `@ChatGPT`, `@Gemini`, `@Claude`, atau `To Gemini`. Tanpa penunjukan, penjawab pertama dipilih secara acak.
- **Bagikan konteks visual.** Lampirkan atau tempel hingga empat gambar dan diskusikan berdasarkan nomornya.
- **Bagikan halaman saat ini.** Jika diinginkan, sertakan teks halaman yang dapat dibaca sebagai bahan referensi rapat.
- **Ringkas dan salin.** Buat ringkasan untuk ditinjau kembali atau dipakai dalam rapat berikutnya.
- **Panel samping dan tampilan diperluas.** Beralih tata letak, sembunyikan kontrol peserta, dan sesuaikan ukuran teks log.
- **Sembilan bahasa antarmuka.** Inggris, Jepang, Prancis (Prancis), Jerman (Jerman), Spanyol (Amerika Serikat), Italia, Indonesia, Portugis (Brasil), dan Hindi. Pilihan awal mengikuti preferensi browser, dengan bahasa Inggris sebagai cadangan; pilihan manual disimpan. Mode gelap mengikuti preferensi browser atau sistem.

VaultSessions adalah bukti konsep antarmuka rapat yang mempertemukan konteks dan kepribadian AI yang berbeda dengan perspektif manusia. Proyek ini tidak berafiliasi dengan atau didukung oleh OpenAI, Google, maupun Anthropic.

## Instalasi

```text
VaultSessions/
├── README.md
├── LICENSE
├── SECURITY.md
├── docs/
└── VaultSessions/       ← Muat folder ini di Chrome
    ├── manifest.json
    ├── meeting.html
    ├── start.command
    ├── start.bat
    ├── serve.py
    ├── icons/
    ├── i18n/
    └── ...
```

1. Unduh atau klon repositori ini ke folder yang akan Anda simpan secara permanen.
2. Buka `chrome://extensions/` dan aktifkan **Mode developer**.
3. Klik **Muat yang belum dipaketkan** lalu pilih folder bagian dalam **`VaultSessions/`** yang berisi `manifest.json`, bukan folder akar repositori.
4. Buka situs resmi ChatGPT, Gemini, dan/atau Claude, lalu masuk sendiri ke akun Anda.
5. Klik ikon ekstensi VaultSessions pada tab tempat Anda ingin menampilkan panel rapat.

Gunakan Chrome versi terbaru. Versi minimum dalam manifest adalah Chrome 116, tetapi kompatibilitas API browser dan antarmuka penyedia dapat berbeda. Rapat biasa tidak memerlukan proses build atau server.

Setelah memperbarui berkas, muat ulang ekstensi, tab resmi AI, dan tampilan rapat.

**Dukungan Windows:** Petunjuk penyiapan dan skrip peluncur untuk Windows tersedia, tetapi VaultSessions belum diuji pada komputer Windows. Fokus jendela, input IME, penempelan gambar dari papan klip, serta peralihan antara bilah sisi dan layar penuh masih perlu diverifikasi di Windows.

### Tampilan diperluas tanpa server

1. Di **Detail** ekstensi, aktifkan **Izinkan akses ke URL file**.
2. Buka `VaultSessions/meeting.html` di Chrome.
3. Klik **Daftarkan halaman rapat ini** untuk menyimpan URL lokal persisnya di penyimpanan lokal ekstensi.
4. Gunakan kontrol pada header untuk beralih antara panel samping dan tampilan diperluas.

Jika folder dipindahkan, buka dan daftarkan ulang `meeting.html` di lokasi baru. Peralihan dari panel samping memakai tab saat ini; tombol Kembali pada browser mengembalikan situs sebelumnya. Log diteruskan, tetapi koneksi AI mungkin perlu disambungkan lagi.

### Mode localhost opsional

Beberapa panel AI di browser tidak dapat berinteraksi dengan halaman `file://`. Untuk integrasi tersebut, instal Python 3 dan jalankan server loopback opsional:

| Platform | Peluncur | Alternatif terminal, dari folder bagian dalam `VaultSessions/` |
| --- | --- | --- |
| macOS | Klik dua kali `VaultSessions/start.command` | `python3 serve.py` |
| Windows | Klik dua kali `VaultSessions/start.bat` | `py -3 serve.py` atau `python serve.py` |

Jika peluncur macOS kehilangan izin eksekusi, gunakan `chmod +x start.command` atau perintah terminal di atas. Biarkan jendela terminal terbuka; Ctrl+C menghentikan server. Port 8766 harus tersedia.

Di rapat berbasis file, klik **?**, lalu gunakan tombol pemeriksaan server dan pembukaan localhost di dialog bantuan. Tombol ini memeriksa server dan menyimpan log saat ini sebelum berpindah. Alamatnya adalah `http://127.0.0.1:8766/meeting.html`.

Server hanya menyajikan berkas dari folder bagian dalam `VaultSessions/` melalui loopback. Jangan simpan rahasia atau berkas pribadi di folder tersebut. Ekstensi harus tetap aktif pada kedua mode.

## Penggunaan

### Memulai rapat

Tab AI yang tersedia terhubung otomatis. Jika ada beberapa tab untuk penyedia yang sama, pilih percakapan yang diinginkan. Anda dapat memutuskan koneksi AI tanpa menutup tabnya; koneksi ulang otomatis dijeda pada tampilan rapat tersebut sampai Anda menghubungkannya kembali.

Ketik topik dan tekan Enter. Shift+Enter membuat baris baru; saat komposisi IME berlangsung, pesan tidak dikirim. Dengan beberapa AI terhubung, peserta lain mengikuti penjawab pertama secara berurutan. Sebutkan penerima di bagian mana pun dalam pesan untuk memilih penjawab pertama; huruf besar/kecil tidak dibedakan dan penunjukan eksplisit pertama yang dipakai.

Batas awal adalah **3 kontribusi** dan **6 permintaan**. PASS dihitung sebagai permintaan, bukan kontribusi. Diskusi juga berakhir jika semua peserta yang terhubung melewati giliran secara berturut-turut. Gunakan **Hentikan diskusi** untuk mencegah giliran selanjutnya; jawaban yang sedang diproses mungkin masih perlu diambil sebelum input dibuka kembali.

Tab AI ditampilkan di depan saat pengiriman dan pengambilan jawaban. Hindari mengedit atau berpindah percakapan tersebut selama giliran berjalan. Perlindungan input membantu mencegah pengetikan tidak sengaja setelah perpindahan fokus. Instruksi peran adalah pesan chat biasa, bukan system role; kepribadian yang tetap sama dan kepatuhan terhadap instruksi tidak dapat dijamin.

### Gambar dan ringkasan

Lampirkan hingga empat gambar PNG, JPEG, atau WebP: **5 MB per gambar, total 10 MB**. Tempel gambar ke kolom pesan atau gunakan tombol lampiran. Jika data yang ditempel berisi gambar, pemrosesan gambar diprioritaskan daripada teks. Tinjau pratinjau dan hapus lampiran yang tidak diperlukan sebelum mengirim.

VaultSessions meneruskan gambar ke tab AI resmi di dalam browser, tanpa server perantara yang dioperasikan proyek. Situs resmi kemudian mengunggahnya ke penyedia saat dikirim. Nomor gambar dimulai lagi untuk setiap pesan manusia baru yang membawa gambar.

**Ringkas diskusi** memilih satu AI terhubung yang tersedia secara acak. Tindakan ini tidak memulai putaran diskusi baru dan tidak menerapkan anjuran 300 karakter. Jika berhasil, ringkasan menggantikan log yang ditampilkan dan riwayat biasa aplikasi. Salin jika ingin menyimpannya. Jika gagal, log sebelumnya tetap ada. Ringkasan dikecualikan dari riwayat diskusi yang dibuat aplikasi sesudahnya dan dari masukan ringkasan berikutnya; pesan yang sudah dikirim tetap ada dalam percakapan penyedia.

### Tampilan dan penyimpanan sementara

Menu header menyembunyikan kontrol peserta dan pengaturan. **A−**, **A＋**, dan **Ukuran standar** mengubah ukuran teks log, termasuk ringkasan, dari 75% hingga 175%. Pengaturan ini dibagikan antartata letak dan tetap tersimpan setelah browser dimulai ulang.

Snapshot sementara menggunakan `chrome.storage.session`, dengan hingga 500 entri tampilan dan 500 entri riwayat biasa per penyimpanan. Tampilan aktif dapat memuat lebih banyak. Ini bukan arsip permanen. Bahasa, ukuran teks, preferensi berbagi halaman, dan URL file terdaftar memakai penyimpanan lokal browser. Gambar yang dipilih tetapi belum dikirim tidak dipertahankan saat beralih tampilan.

### Privasi, izin, dan kompatibilitas

**Aplikasi ini tidak bekerja sepenuhnya offline atau hanya di loopback.** Koordinasi ekstensi dan penyerahan gambar berlangsung di dalam browser, tetapi situs resmi AI mengirim pesan, gambar, dan teks halaman yang dibagikan ke layanan mereka. VaultSessions tidak memakai endpoint API AI secara langsung dan tidak memerlukan server perantara yang dioperasikan proyek.

Pemeriksaan statis kode menemukan satu `fetch` eksplisit: pemeriksaan opsional `http://127.0.0.1:8766/meeting.html`. Tidak ditemukan klien analitik terpisah, pemuat skrip jarak jauh/CDN, atau klien langsung API AI eksternal. Ini adalah temuan pada kode, **bukan audit rekaman lalu lintas jaringan**, dan bukan pernyataan bahwa tidak ada komunikasi eksternal.

Berbagi halaman dapat mencakup informasi pribadi yang terlihat di halaman tempat Anda sudah masuk. Matikan pada halaman yang tidak ingin dibagikan. Menghapus parameter URL tidak menghapus data pribadi dari teks halaman. Lihat [SECURITY.md](../SECURITY.md) untuk detail izin, aliran data, dan pelaporan keamanan.

**VaultSessions mengotomatiskan situs resmi AI dengan sesi login aktif. Ini dapat bertentangan dengan ketentuan atau aturan akun penyedia. Tinjau ketentuan yang berlaku dan gunakan dengan risiko Anda sendiri. Perubahan antarmuka penyedia, API browser, fitur, atau ketentuan dapat membuat aplikasi berhenti berfungsi atau mengharuskan penggunaan dihentikan.** Aplikasi tidak melewati CAPTCHA atau batas penggunaan. Sumber terbuka tidak berarti perangkat lunak sudah diaudit secara independen atau pasti aman.

### Berkontribusi

Kontribusi sangat diterima!

Fork repositori ini, tingkatkan VaultSessions, lalu kirim Pull Request.

Mari bangun cara yang lebih baik bagi manusia dan AI untuk berpikir bersama.

Distribusi ini tidak menyertakan rangkaian pengujian internal. Jelaskan langkah verifikasi saat mengajukan perubahan, terutama untuk adaptor DOM penyedia. Lihat [VaultSessions/i18n/README.md](../VaultSessions/i18n/README.md) untuk menambahkan bahasa.

## Lisensi

[MIT](../LICENSE) — Copyright (c) 2026 VaultFilms.

Perangkat lunak disediakan **APA ADANYA, TANPA JAMINAN**. Pertahankan pemberitahuan hak cipta, izin, dan penyangkalan jaminan saat mendistribusikannya ulang. Lisensi tidak memberikan izin untuk mengabaikan ketentuan layanan pihak ketiga.

Dibuat oleh [VaultFilms](https://www.youtube.com/channel/UCmiLs19uM0in4ubeyvPHLIQ).
