import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export const useTutorial = (user: any, isAdmin: boolean) => {
  const pathname = usePathname();
  const router = useRouter();

  // Handle cross-page tutorial continuation
  useEffect(() => {
    const tourActive = localStorage.getItem('tour_active');
    const tourStep = parseInt(localStorage.getItem('tour_step') || '0');
    
    if (tourActive === 'true') {
      // Small delay to ensure page elements are rendered
      const timeout = setTimeout(() => {
        startTutorial(tourStep);
      }, 800);
      return () => clearTimeout(timeout);
    }
  }, [pathname]);

  const startTutorial = (initialStep = 0) => {
    const d = driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      popoverClass: 'premium-tour-popover',
      doneBtnText: 'Selesai',
      nextBtnText: 'Lanjut',
      prevBtnText: 'Kembali',
      stagePadding: 10,
      onCloseClick: () => {
        localStorage.removeItem('tour_active');
        localStorage.removeItem('tour_step');
      },
      onDestroyed: () => {
        // Only remove session if it's not a navigation-triggered destruction
        if (!localStorage.getItem('tour_navigating')) {
          localStorage.removeItem('tour_active');
          localStorage.removeItem('tour_step');
        }
        localStorage.removeItem('tour_navigating');
      }
    });

    let steps: any[] = [];

    // Dashboard Page
    if (pathname === '/dashboard/dashboard') {
      steps = [
        {
          element: '#tour-dash-stats',
          popover: {
            title: '📊 Ringkasan Statistik',
            description: isAdmin 
              ? 'Dashboard ini merangkum seluruh performa pipeline, total leads, dan total aktivitas tim Anda secara real-time.' 
              : 'Pantau pencapaian tugas dan pipeline Anda di sini. Semakin tinggi angkanya, semakin baik!',
            position: 'bottom'
          }
        },
        {
          element: '#tour-dash-chart',
          popover: {
            title: '📈 Analisis Visual',
            description: 'Lihat distribusi aging lead (kesegaran data) dan breakdown aktivitas produk. Grafik ini membantu Anda fokus pada lead yang kritis.',
            position: 'top'
          }
        },
        {
          element: 'a[href="/dashboard/tasks"]',
          popover: {
            title: '🚀 Lanjut ke Manajemen Task',
            description: 'Ayo kita lihat bagaimana cara mengelola tugas follow-up lead secara lebih detail.',
            position: 'right',
            onNextClick: () => {
              localStorage.setItem('tour_active', 'true');
              localStorage.setItem('tour_step', '0');
              localStorage.setItem('tour_navigating', 'true');
              router.push('/dashboard/tasks');
              d.destroy();
            }
          }
        }
      ];
    }

    // Tasks Page
    else if (pathname === '/dashboard/tasks') {
      steps = [
        {
          element: '#tour-view-toggle',
          popover: {
            title: '🏢 Ganti Tampilan',
            description: 'Anda bisa memilih tampilan "Grouped" untuk fokus pada Lead (Keluarga) atau "List View" untuk daftar tugas yang lurus.',
            position: 'bottom'
          }
        },
        {
          element: '#tour-export-toolbar',
          popover: {
            title: '📅 Filter & Ekspor',
            description: 'Pilih periode waktu dan unduh laporan dalam format Excel/CSV dengan sekali klik.',
            position: 'bottom'
          }
        },
        {
          element: '.filter-group-modern',
          popover: {
            title: '🔍 Filter Canggih',
            description: 'Cari lead berdasarkan nama atau filter berdasarkan status dan tipe leads (Inten/Eksten) di sini.',
            position: 'bottom'
          }
        },
        {
          element: '.leads-container',
          popover: {
            title: '📝 Kelola Follow-up',
            description: isAdmin 
              ? 'Sebagai Admin, Anda dapat mengatur (Assign) petugas untuk tiap lead di bagian ini.'
              : 'Klik pada card lead untuk melihat sub-tugas. Ubah status task untuk memperbarui progress Anda.',
            position: 'top'
          }
        },
        {
          element: 'a[href="/dashboard/monitoring"]',
          popover: {
            title: '📍 Pantau Aktivitas',
            description: 'Mari kita lihat bagaimana cara melaporkan aktivitas harian Anda (GMM, KSM, KPR, CC).',
            position: 'right',
            onNextClick: () => {
              localStorage.setItem('tour_active', 'true');
              localStorage.setItem('tour_step', '0');
              localStorage.setItem('tour_navigating', 'true');
              router.push('/dashboard/monitoring');
              d.destroy();
            }
          }
        }
      ];
    }

    // Monitoring Page
    else if (pathname === '/dashboard/monitoring') {
      steps = [
        {
          element: '#tour-mon-tabs',
          popover: {
            title: '🗂️ Kategori Laporan',
            description: 'Pilih jenis aktivitas yang ingin Anda laporkan. Tiap tab memiliki form yang berbeda-beda.',
            position: 'bottom'
          }
        },
        {
          element: '#tour-mon-add',
          popover: {
            title: '✨ Tambah Laporan Baru',
            description: 'Gunakan tombol ini setiap kali Anda selesai melakukan aktivitas di lapangan atau via telepon.',
            position: 'left'
          }
        },
        {
          element: '#tour-mon-table',
          popover: {
            title: '✅ Status Verifikasi',
            description: isAdmin
              ? 'Admin akan memvalidasi laporan Anda di sini. Pastikan data yang dimasukkan sudah benar!'
              : 'Pantau apakah laporan Anda sudah disetujui atau masih dalam antrian verifikasi.',
            position: 'top'
          }
        }
      ];
    }

    if (steps.length > 0) {
      d.setSteps(steps);
      d.drive(initialStep);
    }
  };

  return { startTutorial };
};
