// Sembunyikan jendela Command Prompt saat app dibuka di Windows.
// Tanpa ini, binary dikompile sebagai console application → Windows
// mengalokasikan jendela console hitam tiap app start. Attribute ini
// menandai binary sebagai GUI application (subsystem "windows").
// Catatan: log/error Rust internal tak lagi tercetak ke console — untuk
// debugging dev, attribute ini otomatis diabaikan karena hanya aktif
// pada profile release (cfg(not(debug_assertions))).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    monitoring_penjualan_lib::run();
}