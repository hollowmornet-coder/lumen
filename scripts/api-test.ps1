# =====================================================================
#  LUMEN - API Smoke Test
#  Menguji alur inti: login, RBAC, peminjaman, stok, pengembalian.
#  Jalankan:  powershell -ExecutionPolicy Bypass -File scripts\api-test.ps1
# =====================================================================
param(
  [string]$BaseUrl = "http://localhost:4000/api",
  [string]$MysqlExe = "D:\UKK\_vendor\mariadb-11.4.7-winx64\bin\mysql.exe",
  [string]$MyIni   = "D:\UKK\_vendor\mariadb-11.4.7-winx64\my.ini",
  [string]$DbUser  = "root",
  [switch]$SkipReset
)

$ErrorActionPreference = "Stop"
$pass = 0
$fail = 0

function Assert-True {
  param([string]$Name, [bool]$Condition, [string]$Detail = "")
  if ($Condition) {
    $script:pass++
    Write-Host "  [PASS] $Name" -ForegroundColor Green
  } else {
    $script:fail++
    Write-Host "  [FAIL] $Name  $Detail" -ForegroundColor Red
  }
}

Write-Host "`n=== LUMEN API TEST ===" -ForegroundColor Cyan
Write-Host "Target: $BaseUrl`n"

# ------------------------------------------------------- RESET DATABASE
# Re-import database.sql so every run starts from the same known state.
# Without this, leftover loans from a previous run make results non-repeatable.
if (-not $SkipReset) {
  Write-Host "[0] Reset database dari database.sql" -ForegroundColor Yellow
  if (Test-Path $MysqlExe) {
    Get-Content "D:\UKK\database.sql" -Encoding UTF8 |
      & $MysqlExe "--defaults-file=$MyIni" -u $DbUser --default-character-set=utf8mb4 2>&1 |
      Select-Object -First 5
    Assert-True "Database direset ke kondisi seed" ($LASTEXITCODE -eq 0) "exit=$LASTEXITCODE"
  } else {
    Write-Host "  [WARN] mysql.exe tidak ditemukan, reset dilewati. Jalankan dengan -SkipReset=false setelah menyiapkan DB." -ForegroundColor Yellow
  }
}

function Invoke-Api {
  param(
    [string]$Method,
    [string]$Path,
    [hashtable]$Body = $null,
    [string]$Token = $null
  )
  $headers = @{}
  if ($Token) { $headers["Authorization"] = "Bearer $Token" }
  $params = @{
    Method  = $Method
    Uri     = "$BaseUrl$Path"
    Headers = $headers
  }
  if ($Body) {
    $params["ContentType"] = "application/json"
    $params["Body"] = ($Body | ConvertTo-Json -Depth 10)
  }
  try {
    $r = Invoke-WebRequest @params -UseBasicParsing
    $json = $r.Content | ConvertFrom-Json
    return @{ Status = $r.StatusCode; Json = $json }
  } catch {
    $status = 0
    $json = $null
    if ($_.Exception.Response) {
      $status = [int]$_.Exception.Response.StatusCode
      try {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $json = $reader.ReadToEnd() | ConvertFrom-Json
      } catch { }
    }
    return @{ Status = $status; Json = $json }
  }
}

# ---------------------------------------------------------------- HEALTH
Write-Host "`n[1] Health & Database" -ForegroundColor Yellow
$h = Invoke-Api -Method GET -Path "/health"
Assert-True "Health endpoint merespons 200" ($h.Status -eq 200) "got $($h.Status)"

# ---------------------------------------------------------------- LOGIN
Write-Host "`n[2] Autentikasi" -ForegroundColor Yellow
$bad = Invoke-Api -Method POST -Path "/auth/login" -Body @{ identifier = "admin"; password = "salah" }
Assert-True "Login dengan kata sandi salah ditolak" ($bad.Status -eq 401) "got $($bad.Status)"

$adminLogin = Invoke-Api -Method POST -Path "/auth/login" -Body @{ identifier = "admin"; password = "Admin123!" }
Assert-True "Login admin berhasil" ($adminLogin.Status -eq 200) "got $($adminLogin.Status)"
$adminToken = $adminLogin.Json.data.token

$userLogin = Invoke-Api -Method POST -Path "/auth/login" -Body @{ identifier = "andira"; password = "Siswa123!" }
Assert-True "Login siswa berhasil" ($userLogin.Status -eq 200) "got $($userLogin.Status)"
$userToken = $userLogin.Json.data.token
$userId = $userLogin.Json.data.user.id

$noAuth = Invoke-Api -Method GET -Path "/books"
Assert-True "Endpoint tanpa token ditolak" ($noAuth.Status -eq 401) "got $($noAuth.Status)"

# ---------------------------------------------------------------- RBAC
Write-Host "`n[3] Otorisasi (RBAC)" -ForegroundColor Yellow
$userHitsMembers = Invoke-Api -Method GET -Path "/members" -Token $userToken
Assert-True "Siswa tidak bisa akses /members" ($userHitsMembers.Status -eq 403) "got $($userHitsMembers.Status)"

$userHitsSettings = Invoke-Api -Method PUT -Path "/settings" -Body @{ max_loan_per_user = 1 } -Token $userToken
Assert-True "Siswa tidak bisa ubah pengaturan" ($userHitsSettings.Status -eq 403) "got $($userHitsSettings.Status)"

$userHitsActivity = Invoke-Api -Method GET -Path "/activity" -Token $userToken
Assert-True "Siswa tidak bisa baca log aktivitas" ($userHitsActivity.Status -eq 403) "got $($userHitsActivity.Status)"

# ---------------------------------------------------------------- CATALOG
Write-Host "`n[4] Katalog" -ForegroundColor Yellow
$books = Invoke-Api -Method GET -Path "/books?pageSize=100" -Token $userToken
Assert-True "Siswa bisa melihat katalog" ($books.Status -eq 200) "got $($books.Status)"

$searched = Invoke-Api -Method GET -Path "/books?search=Laskar&pageSize=5" -Token $userToken
Assert-True "Pencarian judul berfungsi" ($searched.Json.meta.total -ge 1) "total=$($searched.Json.meta.total)"

$target = $books.Json.data | Where-Object { $_.availableCopies -gt 0 } | Select-Object -First 1
Assert-True "Ada buku tersedia untuk pengujian" ($null -ne $target)
$bookId = $target.id
$stockBefore = $target.availableCopies
Write-Host "     -> Buku uji: '$($target.title)' (stok awal $stockBefore)"

# ---------------------------------------------------------------- LOAN FLOW
Write-Host "`n[5] Alur Peminjaman" -ForegroundColor Yellow
$req = Invoke-Api -Method POST -Path "/loans" -Body @{ bookId = $bookId; note = "Uji otomatis" } -Token $userToken
Assert-True "Siswa dapat mengajukan peminjaman" ($req.Status -eq 201) "got $($req.Status) $($req.Json.message)"
$loanId = $req.Json.data.id
$loanStatus = $req.Json.data.status
Assert-True "Status awal = pending" ($loanStatus -eq "pending") "status=$loanStatus"

$dupe = Invoke-Api -Method POST -Path "/loans" -Body @{ bookId = $bookId } -Token $userToken
Assert-True "Permohonan ganda untuk buku sama ditolak" ($dupe.Status -eq 422) "got $($dupe.Status)"

$selfApprove = Invoke-Api -Method POST -Path "/loans/$loanId/approve" -Token $userToken
Assert-True "Siswa tidak bisa menyetujui permohonannya sendiri" ($selfApprove.Status -eq 403) "got $($selfApprove.Status)"

$bookAfterReq = Invoke-Api -Method GET -Path "/books/$bookId" -Token $adminToken
Assert-True "Stok tidak berubah saat masih pending" ($bookAfterReq.Json.data.availableCopies -eq $stockBefore) "stok=$($bookAfterReq.Json.data.availableCopies)"

$appr = Invoke-Api -Method POST -Path "/loans/$loanId/approve" -Token $adminToken
Assert-True "Admin dapat menyetujui" ($appr.Status -eq 200) "got $($appr.Status) $($appr.Json.message)"
Assert-True "Status setelah approve = approved" ($appr.Json.data.status -eq "approved") "status=$($appr.Json.data.status)"
Assert-True "Jatuh tempo terisi" ($null -ne $appr.Json.data.dueAt) "dueAt=$($appr.Json.data.dueAt)"

$bookAfterAppr = Invoke-Api -Method GET -Path "/books/$bookId" -Token $adminToken
Assert-True "Stok berkurang 1 setelah approve" ($bookAfterAppr.Json.data.availableCopies -eq ($stockBefore - 1)) "stok=$($bookAfterAppr.Json.data.availableCopies)"

$borrow = Invoke-Api -Method POST -Path "/loans/$loanId/borrow" -Token $adminToken
Assert-True "Buku ditandai dipinjam" ($borrow.Json.data.status -eq "borrowed") "status=$($borrow.Json.data.status)"

$doubleBorrow = Invoke-Api -Method POST -Path "/loans/$loanId/borrow" -Token $adminToken
Assert-True "Transisi borrowed->borrowed ditolak" ($doubleBorrow.Status -eq 422) "got $($doubleBorrow.Status)"

# ---------------------------------------------------------------- ISOLATION
Write-Host "`n[6] Isolasi Data Antar	User" -ForegroundColor Yellow
$bimaLogin = Invoke-Api -Method POST -Path "/auth/login" -Body @{ identifier = "bima"; password = "Siswa123!" }
$bimaToken = $bimaLogin.Json.data.token
$peek = Invoke-Api -Method GET -Path "/loans/$loanId" -Token $bimaToken
Assert-True "Siswa lain tidak bisa membaca transaksi milik orang lain" ($peek.Status -eq 404) "got $($peek.Status)"

$bimaCancel = Invoke-Api -Method POST -Path "/loans/$loanId/cancel" -Token $bimaToken
Assert-True "Siswa lain tidak bisa membatalkan transaksi orang lain" ($bimaCancel.Status -eq 404) "got $($bimaCancel.Status)"

$bimaLoans = Invoke-Api -Method GET -Path "/loans" -Token $bimaToken
$bimaSeesForeign = ($bimaLoans.Json.data | Where-Object { $_.userId -ne $bimaLogin.Json.data.user.id }).Count -gt 0
Assert-True "Daftar /loans siswa hanya berisi miliknya sendiri" (-not $bimaSeesForeign)

# ---------------------------------------------------------------- RETURN
Write-Host "`n[7] Alur Pengembalian" -ForegroundColor Yellow
$ret = Invoke-Api -Method POST -Path "/loans/$loanId/return-request" -Token $userToken
Assert-True "Siswa dapat mengajukan pengembalian" ($ret.Json.data.status -eq "return_requested") "status=$($ret.Json.data.status)"

$bookMid = Invoke-Api -Method GET -Path "/books/$bookId" -Token $adminToken
Assert-True "Stok belum bertambah sebelum verifikasi petugas" ($bookMid.Json.data.availableCopies -eq ($stockBefore - 1)) "stok=$($bookMid.Json.data.availableCopies)"

$done = Invoke-Api -Method POST -Path "/loans/$loanId/return-confirm" -Body @{ condition = "good"; note = "Kondisi baik" } -Token $adminToken
Assert-True "Petugas dapat mengonfirmasi pengembalian" ($done.Json.data.status -eq "returned") "status=$($done.Json.data.status)"

$bookAfter = Invoke-Api -Method GET -Path "/books/$bookId" -Token $adminToken
Assert-True "Stok kembali seperti semula" ($bookAfter.Json.data.availableCopies -eq $stockBefore) "stok=$($bookAfter.Json.data.availableCopies) vs $stockBefore"

$doubleReturn = Invoke-Api -Method POST -Path "/loans/$loanId/return-confirm" -Body @{ condition = "good" } -Token $adminToken
Assert-True "Pengembalian ganda ditolak" ($doubleReturn.Status -eq 422) "got $($doubleReturn.Status)"

$bookAfterDouble = Invoke-Api -Method GET -Path "/books/$bookId" -Token $adminToken
Assert-True "Stok tidak bertambah lagi setelah pengembalian ganda" ($bookAfterDouble.Json.data.availableCopies -eq $stockBefore) "stok=$($bookAfterDouble.Json.data.availableCopies)"

# ---------------------------------------------------------------- VALIDATION
Write-Host "`n[8] Validasi Input" -ForegroundColor Yellow
$badIsbn = Invoke-Api -Method POST -Path "/books" -Body @{ isbn = "12"; title = "X"; author = "Y"; totalCopies = 1 } -Token $adminToken
Assert-True "ISBN tidak valid ditolak" ($badIsbn.Status -eq 422) "got $($badIsbn.Status)"

$dupeIsbn = Invoke-Api -Method POST -Path "/books" -Body @{ isbn = $target.isbn; title = "Duplikat"; author = "Someone"; totalCopies = 1 } -Token $adminToken
Assert-True "ISBN duplikat ditolak" ($dupeIsbn.Status -eq 409) "got $($dupeIsbn.Status)"

# Unique per run so the script can be re-executed without duplicate conflicts.
$suffix = Get-Random -Minimum 10000 -Maximum 99999
$newUser = "ujitest$suffix"
$newMail = "ujitest$suffix@lumen.sch.id"

$weakPass = Invoke-Api -Method POST -Path "/auth/register" -Body @{ username = $newUser; email = $newMail; fullName = "Test User"; password = "123"; confirmPassword = "123" }
Assert-True "Kata sandi lemah ditolak saat registrasi" ($weakPass.Status -eq 422) "got $($weakPass.Status)"

$mismatch = Invoke-Api -Method POST -Path "/auth/register" -Body @{ username = $newUser; email = $newMail; fullName = "Test User"; password = "Siswa123!"; confirmPassword = "Beda123!" }
Assert-True "Konfirmasi kata sandi tidak cocok ditolak" ($mismatch.Status -eq 422) "got $($mismatch.Status)"

$reg = Invoke-Api -Method POST -Path "/auth/register" -Body @{ username = $newUser; email = $newMail; fullName = "Test User"; password = "Siswa123!"; confirmPassword = "Siswa123!" }
Assert-True "Registrasi siswa berhasil" ($reg.Status -eq 201) "got $($reg.Status)"
Assert-True "Role hasil registrasi = user (bukan admin)" ($reg.Json.data.user.role -eq "user") "role=$($reg.Json.data.user.role)"
Assert-True "Kode anggota dibuat otomatis" ($null -ne $reg.Json.data.user.memberCode) "code=$($reg.Json.data.user.memberCode)"

# ---------------------------------------------------------------- DASHBOARD
Write-Host "`n[9] Dashboard & Statistik" -ForegroundColor Yellow
$ov = Invoke-Api -Method GET -Path "/dashboard/admin/overview" -Token $adminToken
Assert-True "Admin overview merespons" ($ov.Status -eq 200) "got $($ov.Status)"
Assert-True "Total judul > 0" ($ov.Json.data.totalTitles -gt 0) "titles=$($ov.Json.data.totalTitles)"
Assert-True "Total eksemplar >= judul" ($ov.Json.data.totalCopies -ge $ov.Json.data.totalTitles)

$charts = Invoke-Api -Method GET -Path "/dashboard/admin/charts?from=2020-01-01&to=2030-12-31" -Token $adminToken
Assert-True "Charts merespons" ($charts.Status -eq 200) "got $($charts.Status)"
Assert-True "Tren peminjaman punya >=1 titik setelah pengujian" ($charts.Json.data.trend.Count -ge 1) "points=$($charts.Json.data.trend.Count)"

$narrow = Invoke-Api -Method GET -Path "/dashboard/admin/charts?from=1990-01-01&to=1990-01-02" -Token $adminToken
Assert-True "Filter tanggal mengubah hasil (rentang kosong = 0 titik)" ($narrow.Json.data.trend.Count -eq 0) "points=$($narrow.Json.data.trend.Count)"

$userDash = Invoke-Api -Method GET -Path "/dashboard/member/overview" -Token $userToken
Assert-True "Member overview merespons" ($userDash.Status -eq 200) "got $($userDash.Status)"

# ---------------------------------------------------------------- CONCURRENCY
Write-Host "`n[10] Konkurensi: dua approval pada satu eksemplar terakhir" -ForegroundColor Yellow
$tmp = Invoke-Api -Method POST -Path "/books" -Body @{
  isbn = "978-602-$((Get-Random -Minimum 100000 -Maximum 999999))-1"
  title = "Uji Konkurensi"
  author = "Penguji"
  totalCopies = 1
} -Token $adminToken
if ($tmp.Status -eq 201) {
  $cid = $tmp.Json.data.id

  # Both students may legitimately REQUEST the last copy while it is only
  # reserved on approval - the race that matters is when the librarian
  # approves, because that is where available_copies is decremented under
  # SELECT ... FOR UPDATE.
  $a = Invoke-Api -Method POST -Path "/loans" -Body @{ bookId = $cid } -Token $userToken
  $b = Invoke-Api -Method POST -Path "/loans" -Body @{ bookId = $cid } -Token $bimaToken
  Assert-True "Dua permohonan pada buku stok 1 sama-sama tercatat (belum ada reservasi)" (($a.Status -eq 201) -and ($b.Status -eq 201)) "a=$($a.Status) b=$($b.Status)"

  $ap1 = Invoke-Api -Method POST -Path "/loans/$($a.Json.data.id)/approve" -Token $adminToken
  $ap2 = Invoke-Api -Method POST -Path "/loans/$($b.Json.data.id)/approve" -Token $adminToken
  Assert-True "Hanya satu dari dua approval yang berhasil" (($ap1.Status -eq 200) -xor ($ap2.Status -eq 200)) "ap1=$($ap1.Status) ap2=$($ap2.Status)"
  $loser = if ($ap1.Status -eq 200) { $ap2 } else { $ap1 }
  Assert-True "Approval yang kalah ditolak dengan aturan stok" ($loser.Status -eq 422) "got $($loser.Status) $($loser.Json.code)"

  $cb = Invoke-Api -Method GET -Path "/books/$cid" -Token $adminToken
  Assert-True "Stok tidak pernah menjadi negatif" ($cb.Json.data.availableCopies -ge 0) "stok=$($cb.Json.data.availableCopies)"

  $winner = if ($ap1.Status -eq 200) { $a } else { $b }
  $wId = $winner.Json.data.id
  # approved -> borrowed (handover) -> return_requested -> returned
  $hand = Invoke-Api -Method POST -Path "/loans/$wId/borrow" -Token $adminToken
  Assert-True "Peminjam dapat menerima buku (approved -> borrowed)" ($hand.Status -eq 200) "got $($hand.Status)"
  $retReq = Invoke-Api -Method POST -Path "/loans/$wId/return-request" -Token $bimaToken
  # bima may not own it; use the owner token instead
  if ($retReq.Status -ne 200) { $retReq = Invoke-Api -Method POST -Path "/loans/$wId/return-request" -Token $adminToken }
  Invoke-Api -Method POST -Path "/loans/$wId/return-confirm" -Body @{ condition = "good" } -Token $adminToken | Out-Null
  $cb2 = Invoke-Api -Method GET -Path "/books/$cid" -Token $adminToken
  Assert-True "Stok kembali ke 1 setelah pengembalian" ($cb2.Json.data.availableCopies -eq 1) "stok=$($cb2.Json.data.availableCopies)"

  # A loan that is still `pending` must not be able to jump straight to
  # `returned` - the handover step cannot be skipped.
  $loserLoanId = if ($ap1.Status -eq 200) { $b.Json.data.id } else { $a.Json.data.id }
  $skip = Invoke-Api -Method POST -Path "/loans/$loserLoanId/return-confirm" -Body @{ condition = "good" } -Token $adminToken
  Assert-True "Pengembalian dari status pending ditolak" ($skip.Status -eq 422) "got $($skip.Status) $($skip.Json.code)"

  Invoke-Api -Method DELETE -Path "/books/$cid" -Token $adminToken | Out-Null
} else {
  Write-Host "  [SKIP] Gagal membuat buku uji: $($tmp.Json.message)" -ForegroundColor Yellow
}

# ---------------------------------------------------------------- COLLECTIONS
Write-Host "`n[11] Koleksi Penulis & Seri Buku" -ForegroundColor Yellow
$authors = Invoke-Api -Method GET -Path "/collections/authors?pageSize=100" -Token $userToken
Assert-True "Daftar penulis merespons" ($authors.Status -eq 200) "got $($authors.Status)"
Assert-True "Daftar penulis tidak kosong" ($authors.Json.meta.total -gt 0) "total=$($authors.Json.meta.total)"

# A user must see the same public author list as an admin.
$authorsAdmin = Invoke-Api -Method GET -Path "/collections/authors?pageSize=100" -Token $adminToken
Assert-True "Siswa dan admin melihat jumlah penulis yang sama" ($authors.Json.meta.total -eq $authorsAdmin.Json.meta.total) "user=$($authors.Json.meta.total) admin=$($authorsAdmin.Json.meta.total)"

# Titles and copies must never be reported as the same number.
$andira = $authors.Json.data | Where-Object { $_.slug -eq "andrea-hirata" } | Select-Object -First 1
Assert-True "Penulis Andrea Hirata ditemukan" ($null -ne $andira)
Assert-True "Jumlah judul dan eksemplar dibedakan (judul=4, eksemplar=30)" (($andira.titleCount -eq 4) -and ($andira.copyCount -eq 30)) "judul=$($andira.titleCount) eksemplar=$($andira.copyCount)"
Assert-True "Jumlah seri terhitung terpisah" ($andira.seriesCount -ge 1) "seri=$($andira.seriesCount)"

# An author with no books but with a verified series must still surface.
$tere = $authors.Json.data | Where-Object { $_.slug -eq "tere-liye" } | Select-Object -First 1
Assert-True "Penulis tanpa buku tetapi berseri tetap muncul" ($null -ne $tere) "null"
Assert-True "Tere Liye punya 2 seri terverifikasi" ($tere.seriesCount -eq 2) "seri=$($tere.seriesCount)"
Assert-True "Buku Tere Liye masuk ke inventaris perpustakaan" ($tere.titleCount -eq 14) "judul=$($tere.titleCount)"

# Search on authors
$authorSearch = Invoke-Api -Method GET -Path "/collections/authors?search=tere" -Token $userToken
Assert-True "Pencarian penulis berfungsi" ($authorSearch.Json.meta.total -ge 1) "total=$($authorSearch.Json.meta.total)"

# Author detail
$authorDetail = Invoke-Api -Method GET -Path "/collections/authors/andrea-hirata" -Token $userToken
Assert-True "Detail penulis merespons" ($authorDetail.Status -eq 200) "got $($authorDetail.Status)"
Assert-True "Detail penulis memuat daftar seri" ($authorDetail.Json.data.series.Count -ge 1) "seri=$($authorDetail.Json.data.series.Count)"
Assert-True "Karya lepas terpisah dari seri" ($authorDetail.Json.data.looseBooks.Count -ge 1) "lepas=$($authorDetail.Json.data.looseBooks.Count)"

# Series whose titles are not held
$authorTere = Invoke-Api -Method GET -Path "/collections/authors/tere-liye" -Token $userToken
$bumiSeriesId = ($authorTere.Json.data.series | Where-Object { $_.slug -eq "serial-bumi" }).id
Assert-True "Serial Bumi terdaftar" ($null -ne $bumiSeriesId) "id=$bumiSeriesId"
$bumiMeta = $authorTere.Json.data.series | Where-Object { $_.slug -eq 'serial-bumi' }
Assert-True "Serial Bumi: 10 dari 17 judul ada di koleksi" ($bumiMeta.ownedItems -eq 10) "dimiliki=$($bumiMeta.ownedItems)"
Assert-True "Jumlah judul dalam seri != jumlah yang dimiliki" ($bumiMeta.totalItems -ne $bumiMeta.ownedItems) "total=$($bumiMeta.totalItems) dimiliki=$($bumiMeta.ownedItems)"

# Series detail
$series = Invoke-Api -Method GET -Path "/collections/series/$bumiSeriesId" -Token $userToken
Assert-True "Detail seri merespons" ($series.Status -eq 200) "got $($series.Status)"
Assert-True "Serial Bumi memiliki 17 item" ($series.Json.data.items.Count -eq 17) "items=$($series.Json.data.items.Count)"
Assert-True "Semua item terurut naik" (($series.Json.data.items | ForEach-Object { $_.position }) -join ',' -eq ((1..17) -join ','))
$notHeld = @($series.Json.data.items | Where-Object { $_.inLibrary -eq $false })
$heldBumi = @($series.Json.data.items | Where-Object { $_.inLibrary -eq $true })
Assert-True "7 item serial Bumi ditandai belum ada di koleksi" ($notHeld.Count -eq 7) "notHeld=$($notHeld.Count)"
Assert-True "Item di luar koleksi punya book=null (tidak bisa dipinjam)" ($notHeld[0].book -eq $null) "book=$($notHeld[0].book)"
Assert-True "10 item serial Bumi tertaut ke buku sungguhan" ($heldBumi.Count -eq 10 -and $null -ne $heldBumi[0].book.id) "held=$($heldBumi.Count)"

# A series that DOES have holdings
$author3 = Invoke-Api -Method GET -Path "/collections/authors/andrea-hirata" -Token $userToken
$laskarId = ($author3.Json.data.series | Where-Object { $_.slug -eq "trilogi-laskar-pelangi" }).id
$series3 = Invoke-Api -Method GET -Path "/collections/series/$laskarId" -Token $userToken
$held = @($series3.Json.data.items | Where-Object { $_.inLibrary -eq $true })
Assert-True "Trilogi Laskar Pelangi: 3 dari 3 judul ada di koleksi" (($series3.Json.data.items.Count -eq 3) -and ($held.Count -eq 3)) "items=$($series3.Json.data.items.Count) held=$($held.Count)"
Assert-True "Item yang dimiliki punya book.id" ($null -ne $held[0].book.id) "id=$($held[0].book.id)"

# 404 handling
$missingAuthor = Invoke-Api -Method GET -Path "/collections/authors/tidak-ada-sama-sekali" -Token $userToken
Assert-True "Penulis yang tidak ada menghasilkan 404" ($missingAuthor.Status -eq 404) "got $($missingAuthor.Status)"
$missingSeries = Invoke-Api -Method GET -Path "/collections/series/999999" -Token $userToken
Assert-True "Seri yang tidak ada menghasilkan 404" ($missingSeries.Status -eq 404) "got $($missingSeries.Status)"

# Admin-only writes
$userWrites = Invoke-Api -Method POST -Path "/collections/series" -Body @{ authorId = 1; name = "Seri Palsu" } -Token $userToken
Assert-True "Siswa tidak bisa membuat seri (403)" ($userWrites.Status -eq 403) "got $($userWrites.Status)"
$noAuthWrite = Invoke-Api -Method POST -Path "/collections/series" -Body @{ authorId = 1; name = "Seri Palsu" }
Assert-True "Tanpa token tidak bisa membuat seri (401)" ($noAuthWrite.Status -eq 401) "got $($noAuthWrite.Status)"

# Reordering: duplicate positions must be rejected
$badOrder = Invoke-Api -Method PUT -Path "/collections/series/$laskarId/items" -Body @{
  items = @(
    @{ bookId = $null; position = 1 },
    @{ bookId = $null; position = 1 }
  )
} -Token $adminToken
Assert-True "Posisi kembar ditolak (409)" ($badOrder.Status -eq 409) "got $($badOrder.Status) $($badOrder.Json.message)"

# A book by a different author must be rejected
$foreignBook = $held[0].book.id
$wrongAuthor = Invoke-Api -Method PUT -Path "/collections/series/$bumiSeriesId/items" -Body @{
  items = @(@{ bookId = $foreignBook; position = 1 })
} -Token $adminToken
Assert-True "Buku penulis lain ditolak masuk seri (409)" ($wrongAuthor.Status -eq 409) "got $($wrongAuthor.Status)"

# A valid reorder is accepted
$validOrder = Invoke-Api -Method PUT -Path "/collections/series/$laskarId/items" -Body @{
  items = @(
    @{ bookId = $foreignBook; position = 1; note = '2005' },
    @{ bookId = $null; position = 2; note = 'Sang Pemimpi' },
    @{ bookId = $null; position = 3; note = 'Edensor' }
  )
} -Token $adminToken
Assert-True "Urutan seri valid disimpan" ($validOrder.Status -eq 200) "got $($validOrder.Status) $($validOrder.Json.message)"
$afterOrder = Invoke-Api -Method GET -Path "/collections/series/$laskarId" -Token $userToken
Assert-True "Urutan baru terbaca dari backend" ($afterOrder.Json.data.items.Count -eq 3) "items=$($afterOrder.Json.data.items.Count)"

# Validation schema on the reorder payload
$emptyItems = Invoke-Api -Method PUT -Path "/collections/series/$laskarId/items" -Body @{ items = @() } -Token $adminToken
Assert-True "Seri tanpa judul ditolak validasi (422)" ($emptyItems.Status -eq 422) "got $($emptyItems.Status)"

# ---------------------------------------------------------------- REGRESSION
Write-Host "`n[12] Regresi Fitur Lama" -ForegroundColor Yellow
$booksStill = Invoke-Api -Method GET -Path "/books?pageSize=5" -Token $userToken
Assert-True "Katalog biasa tetap berfungsi" ($booksStill.Status -eq 200 -and $booksStill.Json.meta.total -gt 0) "total=$($booksStill.Json.meta.total)"
$searchStill = Invoke-Api -Method GET -Path "/books?search=Habis+Gelap" -Token $userToken
Assert-True "Pencarian buku tetap berfungsi" ($searchStill.Json.meta.total -ge 1) "total=$($searchStill.Json.meta.total)"
$overviewStill = Invoke-Api -Method GET -Path "/dashboard/admin/overview" -Token $adminToken
Assert-True "Dasbor admin tetap berfungsi" ($overviewStill.Status -eq 200 -and $overviewStill.Json.data.totalTitles -gt 0) "titles=$($overviewStill.Json.data.totalTitles)"
$memberStill = Invoke-Api -Method GET -Path "/members" -Token $adminToken
Assert-True "Kelola anggota tetap berfungsi" ($memberStill.Status -eq 200) "got $($memberStill.Status)"
$catsStill = Invoke-Api -Method GET -Path "/categories" -Token $userToken
Assert-True "Kategori tetap berfungsi" ($catsStill.Status -eq 200) "got $($catsStill.Status)"

# Loan flow still intact after the migration
$avail = $booksStill.Json.data | Where-Object { $_.availableCopies -gt 0 } | Select-Object -First 1
$stockBefore = $avail.availableCopies
$req2 = Invoke-Api -Method POST -Path "/loans" -Body @{ bookId = $avail.id } -Token $userToken
Assert-True "Peminjaman tetap bisa diajukan" ($req2.Status -eq 201) "got $($req2.Status) $($req2.Json.message)"
$ap = Invoke-Api -Method POST -Path "/loans/$($req2.Json.data.id)/approve" -Token $adminToken
Assert-True "Persetujuan peminjaman tetap berfungsi" ($ap.Status -eq 200) "got $($ap.Status)"
$bw = Invoke-Api -Method POST -Path "/loans/$($req2.Json.data.id)/borrow" -Token $adminToken
Assert-True "Serah-terima buku tetap berfungsi" ($bw.Json.data.status -eq "borrowed") "status=$($bw.Json.data.status)"
$rt = Invoke-Api -Method POST -Path "/loans/$($req2.Json.data.id)/return-confirm" -Body @{ condition = "good" } -Token $adminToken
Assert-True "Pengembalian tetap berfungsi" ($rt.Json.data.status -eq "returned") "status=$($rt.Json.data.status)"
$ba = Invoke-Api -Method GET -Path "/books/$($avail.id)" -Token $adminToken
Assert-True "Stok kembali utuh setelah pengembalian" ($ba.Json.data.availableCopies -eq $stockBefore) "stok=$($ba.Json.data.availableCopies) vs $stockBefore"

# ---------------------------------------------------------------- PROFIL
Write-Host "`n[13] Profil & Akun (keduanya role)" -ForegroundColor Yellow

# GET /auth/me harus mengembalikan profil LENGKAP, bukan hanya 5 field.
$meUser = Invoke-Api -Method GET -Path "/auth/me" -Token $userToken
Assert-True "GET /auth/me untuk siswa merespons" ($meUser.Status -eq 200) "got $($meUser.Status)"
Assert-True "/auth/me memuat memberCode" ($null -ne $meUser.Json.data.memberCode) "code=$($meUser.Json.data.memberCode)"
Assert-True "/auth/me memuat className" ($null -ne $meUser.Json.data.className) "kelas=$($meUser.Json.data.className)"
Assert-True "/auth/me TIDAK membocorkan password_hash" ($null -eq $meUser.Json.data.passwordHash -and $null -eq $meUser.Json.data.password_hash)

$meAdmin = Invoke-Api -Method GET -Path "/auth/me" -Token $adminToken
Assert-True "GET /auth/me untuk admin merespons" ($meAdmin.Status -eq 200) "got $($meAdmin.Status)"
Assert-True "Admin punya role admin" ($meAdmin.Json.data.role -eq "admin") "role=$($meAdmin.Json.data.role)"

# Ubah profil sendiri
$beforeName = $userLogin.Json.data.user.fullName
$prof = Invoke-Api -Method PATCH -Path "/auth/profile" -Body @{ className = "XII RPL 1" } -Token $userToken
Assert-True "Siswa dapat mengubah profilnya sendiri" ($prof.Status -eq 200) "got $($prof.Status)"
$badProf = Invoke-Api -Method PATCH -Path "/auth/profile" -Body @{ fullName = "X" } -Token $userToken
Assert-True "Profil dengan nama terlalu pendek ditolak (422)" ($badProf.Status -eq 422) "got $($badProf.Status)"

# Ganti kata sandi, lalu login ulang dengan yang baru
$pw = Invoke-Api -Method POST -Path "/auth/change-password" -Body @{
  currentPassword = "Siswa123!"; newPassword = "BaruSekali9"; confirmPassword = "BaruSekali9"
} -Token $userToken
Assert-True "Siswa dapat mengganti kata sandinya" ($pw.Status -eq 200) "got $($pw.Status)"
$oldPw = Invoke-Api -Method POST -Path "/auth/login" -Body @{ identifier = "andira"; password = "Siswa123!" }
Assert-True "Kata sandi lama tidak lagi berlaku" ($oldPw.Status -eq 401) "got $($oldPw.Status)"
$newPw = Invoke-Api -Method POST -Path "/auth/login" -Body @{ identifier = "andira"; password = "BaruSekali9" }
Assert-True "Login dengan kata sandi baru berhasil" ($newPw.Status -eq 200) "got $($newPw.Status)"
$wrongCurrent = Invoke-Api -Method POST -Path "/auth/change-password" -Body @{
  currentPassword = "SalahTotal9"; newPassword = "LainSekali9"; confirmPassword = "LainSekali9"
} -Token $newPw.Json.data.token
Assert-True "Ganti kata sandi ditolak bila kata sandi lama salah" ($wrongCurrent.Status -eq 401) "got $($wrongCurrent.Status)"

# Kembalikan kata sandi demo supaya data seed tetap seperti semula
$restore = Invoke-Api -Method POST -Path "/auth/change-password" -Body @{
  currentPassword = "BaruSekali9"; newPassword = "Siswa123!"; confirmPassword = "Siswa123!"
} -Token $newPw.Json.data.token
Assert-True "Kata sandi demo dipulihkan" ($restore.Status -eq 200) "got $($restore.Status)"
$demoBack = Invoke-Api -Method POST -Path "/auth/login" -Body @{ identifier = "andira"; password = "Siswa123!" }
Assert-True "Login dengan kata sandi demo kembali berhasil" ($demoBack.Status -eq 200) "got $($demoBack.Status)"

# ---------------------------------------------------------------- AKSES PENGATURAN
Write-Host "`n[14] Pembatasan Akses Per Role" -ForegroundColor Yellow
$userSettingsRead = Invoke-Api -Method GET -Path "/settings" -Token $userToken
Assert-True "Siswa boleh MEMBACA aturan" ($userSettingsRead.Status -eq 200) "got $($userSettingsRead.Status)"
$userSettingsWrite = Invoke-Api -Method PUT -Path "/settings" -Body @{
  max_loan_per_user = 9; loan_duration_days = 7; require_approval = 1; allow_self_return = 1; late_fee_per_day = 1000
} -Token $userToken
Assert-True "Siswa TIDAK boleh mengubah aturan (403)" ($userSettingsWrite.Status -eq 403) "got $($userSettingsWrite.Status)"

$userBooksWrite = Invoke-Api -Method POST -Path "/books" -Body @{ isbn = "978-602-03-0000-1"; title = "Uji"; author = "Uji"; totalCopies = 1 } -Token $userToken
Assert-True "Siswa TIDAK boleh menambah buku (403)" ($userBooksWrite.Status -eq 403) "got $($userBooksWrite.Status)"

$userSeriesWrite = Invoke-Api -Method PUT -Path "/collections/series/1/items" -Body @{ items = @(@{ bookId = $null; position = 1 }) } -Token $userToken
Assert-True "Siswa TIDAK boleh mengubah isi seri (403)" ($userSeriesWrite.Status -eq 403) "got $($userSeriesWrite.Status)"

$userActivityRead = Invoke-Api -Method GET -Path "/activity" -Token $userToken
Assert-True "Siswa TIDAK boleh membaca log aktivitas (403)" ($userActivityRead.Status -eq 403) "got $($userActivityRead.Status)"

$userMembersRead = Invoke-Api -Method GET -Path "/members" -Token $userToken
Assert-True "Siswa TIDAK boleh membaca daftar anggota (403)" ($userMembersRead.Status -eq 403) "got $($userMembersRead.Status)"

$adminCatalogRead = Invoke-Api -Method GET -Path "/books?pageSize=3" -Token $adminToken
Assert-True "Admin juga bisa membaca katalog" ($adminCatalogRead.Status -eq 200) "got $($adminCatalogRead.Status)"
$adminSeriesRead = Invoke-Api -Method GET -Path "/collections/series/1" -Token $adminToken
Assert-True "Admin bisa membaca detail seri" ($adminSeriesRead.Status -eq 200) "got $($adminSeriesRead.Status)"

# ---------------------------------------------------------------- SAMPUL
Write-Host "`n[15] Sampul Buku" -ForegroundColor Yellow
$withCover = Invoke-Api -Method GET -Path "/books?pageSize=100" -Token $userToken
$bercover = @($withCover.Json.data | Where-Object { $_.coverPath })
Assert-True "Sebagian buku memiliki sampul" ($bercover.Count -gt 0) "jumlah=$($bercover.Count)"
Assert-True "Seluruh cover penunjuk ke /uploads/covers/" (@($bercover | Where-Object { $_.coverPath -notlike "/uploads/covers/*" }).Count -eq 0)

# Berkas cover dilayani dari root server (static), bukan di bawah /api,
# jadi harus diambil tanpa prefiks /api.
$sampleCover = $bercover[0].coverPath
$coverUrl = $BaseUrl -replace '/api$', ''
try {
  $coverRes = Invoke-WebRequest "$coverUrl$sampleCover" -UseBasicParsing
  $coverStatus = $coverRes.StatusCode
} catch { $coverStatus = 0 }
Assert-True "Berkas sampul dapat diambil lewat server" ($coverStatus -eq 200) "got $coverStatus $sampleCover"

$tereBooks = @($withCover.Json.data | Where-Object { $_.author -eq "Tere Liye" })
Assert-True "Buku Tere Liye masuk ke inventaris" ($tereBooks.Count -ge 10) "jumlah=$($tereBooks.Count)"
Assert-True "Buku Tere Liye memiliki sampul" (@($tereBooks | Where-Object { $_.coverPath }).Count -ge 8)

# ---------------------------------------------------------------- SUMMARY
Write-Host "`n=== HASIL ===" -ForegroundColor Cyan
Write-Host "Lulus  : $pass" -ForegroundColor Green
Write-Host "Gagal  : $fail" -ForegroundColor Red
Write-Host ""
if ($fail -eq 0) { Write-Host "SEMUA PENGUJIAN LULUS" -ForegroundColor Green } else { Write-Host "ADA PENGUJIAN GAGAL" -ForegroundColor Red }
