// HTML Previewer 큐레이션 데이터 — 링크·라이선스·스타 수 확인일: 2026-10-06
// embeddable: 데모 사이트가 iframe 삽입을 허용하는지(X-Frame-Options / CSP 헤더 검사 + 실제 브라우저 iframe 실측)
// htmlReady: 빌드 없이 단일 HTML 파일에서 바로 쓸 수 있는지
window.PREVIEWER_DATA = {
  "checkedAt": "2026-10-06",
  "categories": [
    {
      "id": "dashboard",
      "label": "대시보드",
      "hint": "KPI·차트·표로 결과를 한 화면에 요약"
    },
    {
      "id": "report",
      "label": "보고서·문서",
      "hint": "분석 보고서, 데이터 리포트, 기술 문서"
    },
    {
      "id": "landing",
      "label": "소개·랜딩",
      "hint": "프로젝트·제품을 한 페이지로 소개"
    },
    {
      "id": "slides",
      "label": "발표",
      "hint": "결과를 슬라이드로 발표"
    },
    {
      "id": "charts",
      "label": "차트",
      "hint": "결과물에 넣을 차트 라이브러리"
    },
    {
      "id": "uikit",
      "label": "UI 키트",
      "hint": "컴포넌트·디자인 시스템"
    }
  ],
  "moreSources": [
    {
      "label": "Tremor Blocks 템플릿",
      "url": "https://blocks.tremor.so/templates",
      "note": "데이터 대시보드 템플릿(무료 공개)"
    },
    {
      "label": "ThemeSelection 무료 관리자 템플릿",
      "url": "https://themeselection.com/item/category/free-admin-templates/",
      "note": "Bootstrap·Tailwind 대시보드"
    },
    {
      "label": "Creative Tim 무료 템플릿",
      "url": "https://www.creative-tim.com/templates/free",
      "note": "대시보드·UI 키트"
    },
    {
      "label": "Quarto 갤러리",
      "url": "https://quarto.org/docs/gallery/",
      "note": "분석 보고서·대시보드 예제"
    },
    {
      "label": "HTML5 UP",
      "url": "https://html5up.net/",
      "note": "정적 HTML 랜딩(CC BY 3.0)"
    },
    {
      "label": "Start Bootstrap 테마",
      "url": "https://startbootstrap.com/themes",
      "note": "Bootstrap 랜딩·관리자(MIT)"
    },
    {
      "label": "Astro 테마",
      "url": "https://astro.build/themes/",
      "note": "랜딩·문서·블로그"
    },
    {
      "label": "Cruip",
      "url": "https://cruip.com/",
      "note": "Tailwind 랜딩"
    },
    {
      "label": "ThemeWagon",
      "url": "https://themewagon.com/",
      "note": "무료·유료 템플릿 모음"
    },
    {
      "label": "Slidev 테마 갤러리",
      "url": "https://sli.dev/resources/theme-gallery",
      "note": "발표 테마"
    }
  ],
  "items": [
    {
      "id": "tabler",
      "name": "Tabler",
      "vendor": "tabler.io",
      "category": "dashboard",
      "pick": true,
      "preview": "https://preview.tabler.io/",
      "stack": [
        "Bootstrap 5"
      ],
      "htmlReady": true,
      "license": "MIT",
      "pricing": "free",
      "desc": "이번 큐레이션의 기준점입니다. 여백·글자 크기·카드 밀도의 균형이 좋고, 대시보드 외에도 카드·인보이스·가격표 등 페이지가 풍부합니다.",
      "tags": [
        "기준",
        "다크 모드",
        "KPI",
        "차트",
        "표",
        "인보이스"
      ],
      "more": [
        {
          "label": "카드 페이지",
          "url": "https://preview.tabler.io/cards.html"
        },
        {
          "label": "인보이스 페이지",
          "url": "https://preview.tabler.io/invoice.html"
        }
      ],
      "source": "https://github.com/tabler/tabler",
      "sourceLabel": "GitHub",
      "stars": 41816,
      "pushed": "2026-10-05",
      "embeddable": true,
      "thumb": "thumbs/tabler.jpg",
      "rank": 0,
      "licenseNote": null
    },
    {
      "id": "shadcn-dashboard",
      "name": "shadcn/ui Dashboard",
      "vendor": "shadcn",
      "category": "dashboard",
      "pick": true,
      "preview": "https://ui.shadcn.com/view/new-york-v4/dashboard-01",
      "stack": [
        "React",
        "Tailwind CSS"
      ],
      "htmlReady": false,
      "license": "MIT",
      "pricing": "free",
      "desc": "요즘 SaaS 화면의 표준처럼 쓰이는 shadcn/ui 스타일입니다. 무채색 위주의 단정한 카드·차트·표로 구성된 dashboard-01 블록입니다.",
      "tags": [
        "모던",
        "SaaS",
        "무채색",
        "블록"
      ],
      "more": [
        {
          "label": "예제 모음",
          "url": "https://ui.shadcn.com/examples/dashboard"
        }
      ],
      "source": "https://github.com/shadcn-ui/ui",
      "sourceLabel": "GitHub",
      "stars": 125122,
      "pushed": "2026-10-05",
      "embeddable": true,
      "thumb": "thumbs/shadcn-dashboard.jpg",
      "rank": 1,
      "licenseNote": null
    },
    {
      "id": "tremor-dashboard",
      "name": "Tremor Dashboard",
      "vendor": "Tremor (Vercel)",
      "category": "dashboard",
      "pick": true,
      "preview": "https://dashboard.tremor.so/overview",
      "source": "https://blocks.tremor.so/templates",
      "stack": [
        "Next.js",
        "Tailwind CSS"
      ],
      "htmlReady": false,
      "license": "Apache-2.0 (OSS판)",
      "pricing": "free",
      "licenseNote": "전체판은 Tremor Blocks에서 무료로 공개(공식 사이트 기재). 축소 OSS판 저장소는 Apache-2.0입니다.",
      "desc": "차트·지표에 특화된 Tremor의 공식 템플릿입니다. 얇은 선과 작은 글자로 정보 밀도가 높은 데이터 대시보드에 어울립니다.",
      "tags": [
        "데이터 밀도",
        "지표",
        "SaaS",
        "차트"
      ],
      "more": [
        {
          "label": "Overview 템플릿",
          "url": "https://overview.tremor.so/"
        },
        {
          "label": "OSS판 GitHub",
          "url": "https://github.com/tremorlabs/template-dashboard-oss"
        }
      ],
      "sourceLabel": "홈페이지",
      "stars": null,
      "pushed": null,
      "embeddable": true,
      "thumb": "thumbs/tremor-dashboard.jpg",
      "rank": 2
    },
    {
      "id": "adminlte",
      "name": "AdminLTE 4",
      "vendor": "ColorlibHQ",
      "category": "dashboard",
      "preview": "https://adminlte.io/themes/v4/",
      "stack": [
        "Bootstrap 5"
      ],
      "htmlReady": true,
      "license": "MIT",
      "pricing": "free",
      "desc": "가장 널리 쓰인 관리자 템플릿의 v4입니다. 색이 강한 KPI 박스와 익숙한 사이드바 구조라 업무용 화면 구성을 참고하기 좋습니다.",
      "tags": [
        "정석",
        "KPI 박스",
        "사이드바",
        "지도"
      ],
      "source": "https://github.com/ColorlibHQ/AdminLTE",
      "sourceLabel": "GitHub",
      "stars": 45636,
      "pushed": "2026-10-01",
      "embeddable": true,
      "thumb": "thumbs/adminlte.jpg",
      "rank": 3,
      "pick": false,
      "more": [],
      "licenseNote": null
    },
    {
      "id": "adminkit",
      "name": "AdminKit",
      "vendor": "AdminKit",
      "category": "dashboard",
      "preview": "https://demo.adminkit.io/",
      "stack": [
        "Bootstrap 5"
      ],
      "htmlReady": true,
      "license": "MIT",
      "pricing": "free",
      "desc": "절제된 색과 넓은 여백의 깔끔한 Bootstrap 5 템플릿입니다. 첫 화면에 테마 설정 패널(Pro 안내 포함)이 열려 있습니다.",
      "tags": [
        "미니멀",
        "캘린더",
        "지도"
      ],
      "source": "https://github.com/adminkit/adminkit",
      "sourceLabel": "GitHub",
      "stars": 1656,
      "pushed": "2026-09-13",
      "embeddable": true,
      "thumb": "thumbs/adminkit.jpg",
      "rank": 4,
      "pick": false,
      "more": [],
      "licenseNote": null
    },
    {
      "id": "coreui",
      "name": "CoreUI Free",
      "vendor": "CoreUI",
      "category": "dashboard",
      "preview": "https://coreui.io/demos/bootstrap/5.3/free/",
      "stack": [
        "Bootstrap 5"
      ],
      "htmlReady": true,
      "license": "MIT",
      "pricing": "free",
      "desc": "컬러 KPI 카드와 큰 트래픽 차트가 있는 정석형 대시보드입니다. 컴포넌트 문서가 잘 갖춰져 있습니다.",
      "tags": [
        "정석",
        "KPI 카드",
        "차트"
      ],
      "source": "https://github.com/coreui/coreui-free-bootstrap-admin-template",
      "sourceLabel": "GitHub",
      "stars": 12250,
      "pushed": "2026-08-14",
      "embeddable": true,
      "thumb": "thumbs/coreui.jpg",
      "rank": 5,
      "pick": false,
      "more": [],
      "licenseNote": null
    },
    {
      "id": "sneat",
      "name": "Sneat Free",
      "vendor": "ThemeSelection",
      "category": "dashboard",
      "preview": "https://demos.themeselection.com/sneat-bootstrap-html-admin-template-free/html/",
      "stack": [
        "Bootstrap 5"
      ],
      "htmlReady": true,
      "license": "MIT",
      "pricing": "free",
      "desc": "보라색 포인트와 일러스트가 들어간 부드러운 분위기의 대시보드입니다. 메뉴에 Pro 전용 항목이 함께 보입니다.",
      "tags": [
        "일러스트",
        "부드러운",
        "보라"
      ],
      "more": [
        {
          "label": "ThemeSelection 무료 템플릿",
          "url": "https://themeselection.com/item/category/free-admin-templates/"
        }
      ],
      "source": "https://github.com/themeselection/sneat-bootstrap-html-admin-template-free",
      "sourceLabel": "GitHub",
      "stars": 1240,
      "pushed": "2026-03-20",
      "embeddable": true,
      "thumb": "thumbs/sneat.jpg",
      "rank": 6,
      "pick": false,
      "licenseNote": null
    },
    {
      "id": "tailadmin",
      "name": "TailAdmin",
      "vendor": "TailAdmin",
      "category": "dashboard",
      "preview": "https://free-demo.tailadmin.com/",
      "stack": [
        "Tailwind CSS"
      ],
      "htmlReady": true,
      "license": "MIT",
      "pricing": "free",
      "desc": "Tailwind CSS 기반 무료 대시보드입니다. 간결한 카드·막대 차트·목표 게이지 구성이라 Tailwind 스타일 결과물에 참고하기 좋습니다.",
      "tags": [
        "Tailwind",
        "게이지",
        "막대 차트"
      ],
      "source": "https://github.com/TailAdmin/tailadmin-free-tailwind-dashboard-template",
      "sourceLabel": "GitHub",
      "stars": 2344,
      "pushed": "2026-09-15",
      "embeddable": true,
      "thumb": "thumbs/tailadmin.jpg",
      "rank": 7,
      "pick": false,
      "more": [],
      "licenseNote": null
    },
    {
      "id": "flowbite-admin",
      "name": "Flowbite Admin",
      "vendor": "Themesberg",
      "category": "dashboard",
      "preview": "https://flowbite-admin-dashboard.vercel.app/",
      "stack": [
        "Tailwind CSS"
      ],
      "htmlReady": true,
      "license": "MIT",
      "pricing": "free",
      "desc": "Flowbite 컴포넌트로 만든 Tailwind 관리자 화면입니다. 매출 추이 차트와 상품 순위 목록 같은 커머스형 구성입니다.",
      "tags": [
        "커머스",
        "매출",
        "목록"
      ],
      "source": "https://github.com/themesberg/flowbite-admin-dashboard",
      "sourceLabel": "GitHub",
      "stars": 2886,
      "pushed": "2025-03-20",
      "embeddable": true,
      "thumb": "thumbs/flowbite-admin.jpg",
      "rank": 8,
      "pick": false,
      "more": [],
      "licenseNote": null
    },
    {
      "id": "volt",
      "name": "Volt",
      "vendor": "Themesberg",
      "category": "dashboard",
      "preview": "https://demo.themesberg.com/volt/pages/dashboard/dashboard.html",
      "stack": [
        "Bootstrap 5"
      ],
      "htmlReady": true,
      "license": "MIT",
      "pricing": "free",
      "desc": "어두운 사이드바와 따뜻한 포인트 색의 Bootstrap 5 대시보드입니다. 저장소는 2023년 3월 이후 업데이트가 없습니다.",
      "tags": [
        "다크 사이드바",
        "따뜻한 색"
      ],
      "source": "https://github.com/themesberg/volt-bootstrap-5-dashboard",
      "sourceLabel": "GitHub",
      "stars": 2682,
      "pushed": "2023-03-04",
      "embeddable": true,
      "thumb": "thumbs/volt.jpg",
      "rank": 9,
      "pick": false,
      "more": [],
      "licenseNote": null
    },
    {
      "id": "mazer",
      "name": "Mazer",
      "vendor": "zuramai",
      "category": "dashboard",
      "preview": "https://zuramai.github.io/mazer/demo/index.html",
      "stack": [
        "Bootstrap 5"
      ],
      "htmlReady": true,
      "license": "MIT",
      "pricing": "free",
      "desc": "밝고 가벼운 톤의 Bootstrap 5 대시보드입니다. 라이트/다크 테마를 모두 제공합니다.",
      "tags": [
        "가벼운",
        "다크 모드"
      ],
      "source": "https://github.com/zuramai/mazer",
      "sourceLabel": "GitHub",
      "stars": 3107,
      "pushed": "2025-08-05",
      "embeddable": true,
      "thumb": "thumbs/mazer.jpg",
      "rank": 10,
      "pick": false,
      "more": [],
      "licenseNote": null
    },
    {
      "id": "windmill",
      "name": "Windmill Dashboard",
      "vendor": "Estevan Maito",
      "category": "dashboard",
      "preview": "https://windmill-dashboard.vercel.app/",
      "stack": [
        "Tailwind CSS"
      ],
      "htmlReady": true,
      "license": "MIT",
      "pricing": "free",
      "desc": "Tailwind CSS로 만든 가벼운 대시보드입니다. 접근성을 고려했고 다크 테마를 지원합니다.",
      "tags": [
        "접근성",
        "다크 모드",
        "표"
      ],
      "source": "https://github.com/estevanmaito/windmill-dashboard",
      "sourceLabel": "GitHub",
      "stars": 3036,
      "pushed": "2024-02-28",
      "embeddable": true,
      "thumb": "thumbs/windmill.jpg",
      "rank": 11,
      "pick": false,
      "more": [],
      "licenseNote": null
    },
    {
      "id": "material-dashboard",
      "name": "Material Dashboard 3",
      "vendor": "Creative Tim",
      "category": "dashboard",
      "preview": "https://demos.creative-tim.com/material-dashboard-free/pages/dashboard.html",
      "stack": [
        "Bootstrap 5"
      ],
      "htmlReady": true,
      "license": "MIT",
      "pricing": "free",
      "desc": "Google Material Design 느낌의 Bootstrap 5 대시보드입니다. 상단에 제작사 프로모션 배너가 표시됩니다.",
      "tags": [
        "머티리얼",
        "카드"
      ],
      "more": [
        {
          "label": "Creative Tim 무료 템플릿",
          "url": "https://www.creative-tim.com/templates/free"
        }
      ],
      "source": "https://github.com/creativetimofficial/material-dashboard",
      "sourceLabel": "GitHub",
      "stars": 12072,
      "pushed": "2026-03-14",
      "embeddable": true,
      "thumb": "thumbs/material-dashboard.jpg",
      "rank": 12,
      "pick": false,
      "licenseNote": null
    },
    {
      "id": "soft-ui",
      "name": "Soft UI Dashboard 3",
      "vendor": "Creative Tim",
      "category": "dashboard",
      "preview": "https://demos.creative-tim.com/soft-ui-dashboard/pages/dashboard.html",
      "stack": [
        "Bootstrap 5"
      ],
      "htmlReady": true,
      "license": "MIT",
      "pricing": "free",
      "desc": "부드러운 그림자와 그라데이션 아이콘의 ‘Soft UI’ 스타일 대시보드입니다. 상단에 제작사 배너가 표시됩니다.",
      "tags": [
        "소프트 UI",
        "그라데이션"
      ],
      "source": "https://github.com/creativetimofficial/soft-ui-dashboard",
      "sourceLabel": "GitHub",
      "stars": 600,
      "pushed": "2024-10-25",
      "embeddable": true,
      "thumb": "thumbs/soft-ui.jpg",
      "rank": 13,
      "pick": false,
      "more": [],
      "licenseNote": null
    },
    {
      "id": "ant-design-pro",
      "name": "Ant Design Pro",
      "vendor": "Ant Group",
      "category": "dashboard",
      "preview": "https://preview.pro.ant.design/",
      "stack": [
        "React",
        "Ant Design"
      ],
      "htmlReady": false,
      "license": "MIT",
      "pricing": "free",
      "desc": "앤트 그룹의 엔터프라이즈 관리자 솔루션으로, 데이터가 빽빽한 업무 화면의 정석입니다. 데모는 중국어로 열리며 상단 지구본 아이콘에서 언어를 바꿀 수 있습니다.",
      "tags": [
        "엔터프라이즈",
        "업무 화면",
        "고밀도"
      ],
      "source": "https://github.com/ant-design/ant-design-pro",
      "sourceLabel": "GitHub",
      "stars": 38833,
      "pushed": "2026-10-04",
      "embeddable": true,
      "thumb": "thumbs/ant-design-pro.jpg",
      "rank": 14,
      "pick": false,
      "more": [],
      "licenseNote": null
    },
    {
      "id": "shadcn-admin",
      "name": "Shadcn Admin",
      "vendor": "satnaing",
      "category": "dashboard",
      "preview": "https://shadcn-admin.netlify.app/",
      "stack": [
        "React",
        "Tailwind CSS"
      ],
      "htmlReady": false,
      "license": "MIT",
      "pricing": "free",
      "desc": "shadcn/ui로 만든 관리자 앱 전체 구성입니다. 대시보드·작업·앱·채팅·사용자·설정·인증 화면까지 갖췄습니다.",
      "tags": [
        "모던",
        "앱 전체",
        "설정"
      ],
      "source": "https://github.com/satnaing/shadcn-admin",
      "sourceLabel": "GitHub",
      "stars": 15600,
      "pushed": "2026-09-10",
      "embeddable": true,
      "thumb": "thumbs/shadcn-admin.jpg",
      "rank": 15,
      "pick": false,
      "more": [],
      "licenseNote": null
    },
    {
      "id": "catalyst",
      "name": "Catalyst",
      "vendor": "Tailwind Labs",
      "category": "dashboard",
      "preview": "https://catalyst-demo.tailwindui.com/",
      "source": null,
      "stack": [
        "React",
        "Tailwind CSS"
      ],
      "htmlReady": false,
      "license": "상용",
      "pricing": "paid",
      "licenseNote": "상용 제품입니다. 구매 전에는 디자인 참고용으로만 보세요. (Tailwind Plus)",
      "desc": "Tailwind CSS 제작사의 공식 애플리케이션 UI 키트입니다. 타이포그래피 중심의 극도로 절제된 디자인입니다.",
      "tags": [
        "미니멀",
        "타이포",
        "Tailwind Plus"
      ],
      "sourceLabel": "홈페이지",
      "stars": null,
      "pushed": null,
      "embeddable": true,
      "thumb": "thumbs/catalyst.jpg",
      "rank": 16,
      "pick": false,
      "more": []
    },
    {
      "id": "metronic",
      "name": "Metronic 9",
      "vendor": "Keenthemes",
      "category": "dashboard",
      "preview": "https://keenthemes.com/metronic/tailwind/demo1/",
      "source": "https://keenthemes.com/metronic",
      "stack": [
        "Tailwind CSS"
      ],
      "htmlReady": true,
      "license": "상용",
      "pricing": "paid",
      "licenseNote": "상용 제품입니다. 구매 전에는 디자인 참고용으로만 보세요.",
      "desc": "데모와 페이지 수가 매우 많은 대형 상용 관리자 템플릿의 최신 Tailwind판입니다.",
      "tags": [
        "대형",
        "다수 데모"
      ],
      "sourceLabel": "홈페이지",
      "stars": null,
      "pushed": null,
      "embeddable": true,
      "thumb": "thumbs/metronic.jpg",
      "rank": 17,
      "pick": false,
      "more": []
    },
    {
      "id": "observable-framework",
      "name": "Observable Framework",
      "vendor": "Observable",
      "category": "report",
      "pick": true,
      "preview": "https://observablehq.observablehq.cloud/framework-example-eia/",
      "stack": [
        "Markdown",
        "JavaScript"
      ],
      "htmlReady": false,
      "license": "ISC",
      "pricing": "free",
      "desc": "Markdown과 JavaScript로 데이터 앱·보고서를 만드는 정적 사이트 도구입니다. 지도·시계열·표가 어우러진 미국 전력망 예제는 ‘분석 보고서형’ 결과물의 좋은 기준입니다.",
      "tags": [
        "데이터 리포트",
        "지도",
        "시계열"
      ],
      "more": [
        {
          "label": "호텔 예약 예제",
          "url": "https://observablehq.observablehq.cloud/framework-example-hotel-bookings/"
        },
        {
          "label": "예제 전체 목록",
          "url": "https://github.com/observablehq/framework/tree/main/examples"
        }
      ],
      "source": "https://github.com/observablehq/framework",
      "sourceLabel": "GitHub",
      "stars": 3657,
      "pushed": "2026-05-15",
      "embeddable": false,
      "thumb": "thumbs/observable-framework.jpg",
      "rank": 18,
      "licenseNote": null
    },
    {
      "id": "quarto",
      "name": "Quarto Dashboards",
      "vendor": "Posit",
      "category": "report",
      "preview": "https://jjallaire.github.io/customer-churn-dashboard/",
      "stack": [
        "Python",
        "R"
      ],
      "htmlReady": false,
      "license": "MIT",
      "pricing": "free",
      "desc": "Python·R 분석 결과를 HTML 대시보드로 바로 내보내는 Quarto입니다. 값 박스·차트·표로 구성된 고객 이탈 분석 예제입니다.",
      "tags": [
        "분석 결과",
        "값 박스",
        "Python"
      ],
      "more": [
        {
          "label": "Quarto 갤러리",
          "url": "https://quarto.org/docs/gallery/"
        },
        {
          "label": "Gapminder 예제",
          "url": "https://jjallaire.github.io/gapminder-dashboard/"
        }
      ],
      "source": "https://github.com/quarto-dev/quarto-cli",
      "sourceLabel": "GitHub",
      "stars": 6058,
      "pushed": "2026-10-05",
      "embeddable": true,
      "thumb": "thumbs/quarto.jpg",
      "rank": 19,
      "pick": false,
      "licenseNote": null
    },
    {
      "id": "tufte-css",
      "name": "Tufte CSS",
      "vendor": "Dave Liepmann",
      "category": "report",
      "preview": "https://edwardtufte.github.io/tufte-css/",
      "stack": [
        "CSS"
      ],
      "htmlReady": true,
      "license": "MIT",
      "pricing": "free",
      "desc": "에드워드 터프티의 책 스타일을 웹으로 옮긴 CSS입니다. 여백 주석(사이드노트)과 세리프 본문으로 ‘잘 읽히는 보고서’를 만듭니다.",
      "tags": [
        "읽기 좋은",
        "사이드노트",
        "세리프"
      ],
      "source": "https://github.com/edwardtufte/tufte-css",
      "sourceLabel": "GitHub",
      "stars": 6572,
      "pushed": "2026-06-24",
      "embeddable": true,
      "thumb": "thumbs/tufte-css.jpg",
      "rank": 20,
      "pick": false,
      "more": [],
      "licenseNote": null
    },
    {
      "id": "mkdocs-material",
      "name": "Material for MkDocs",
      "vendor": "squidfunk",
      "category": "report",
      "preview": "https://squidfunk.github.io/mkdocs-material/",
      "stack": [
        "Python",
        "Markdown"
      ],
      "htmlReady": false,
      "license": "MIT",
      "pricing": "free",
      "desc": "Markdown 문서를 깔끔한 기술 문서 사이트로 만들어 주는 테마입니다. 검색·탭·코드 블록·다크 모드를 기본으로 지원합니다.",
      "tags": [
        "기술 문서",
        "검색",
        "다크 모드"
      ],
      "source": "https://github.com/squidfunk/mkdocs-material",
      "sourceLabel": "GitHub",
      "stars": 27546,
      "pushed": "2026-10-02",
      "embeddable": true,
      "thumb": "thumbs/mkdocs-material.jpg",
      "rank": 21,
      "pick": false,
      "more": [],
      "licenseNote": null
    },
    {
      "id": "starlight",
      "name": "Starlight",
      "vendor": "Astro",
      "category": "report",
      "preview": "https://starlight.astro.build/",
      "stack": [
        "Astro"
      ],
      "htmlReady": false,
      "license": "MIT",
      "pricing": "free",
      "desc": "Astro 기반 문서 테마입니다. 은은한 그라데이션과 카드형 구성으로 모던한 가이드 페이지에 어울립니다.",
      "tags": [
        "가이드",
        "문서"
      ],
      "source": "https://github.com/withastro/starlight",
      "sourceLabel": "GitHub",
      "stars": 9365,
      "pushed": "2026-10-03",
      "embeddable": true,
      "thumb": "thumbs/starlight.jpg",
      "rank": 22,
      "pick": false,
      "more": [],
      "licenseNote": null
    },
    {
      "id": "distill",
      "name": "Distill",
      "vendor": "Distill",
      "category": "report",
      "preview": "https://distill.pub/2017/momentum/",
      "stack": [
        "JavaScript"
      ],
      "htmlReady": true,
      "license": "Apache-2.0",
      "pricing": "free",
      "desc": "인터랙티브 그림이 들어간 연구 논문형 글의 대표 사례(‘Why Momentum Really Works’)입니다. 저널은 2021년부터 휴간 상태입니다.",
      "tags": [
        "논문형",
        "인터랙티브"
      ],
      "more": [
        {
          "label": "휴간 공지",
          "url": "https://distill.pub/2021/distill-hiatus/"
        }
      ],
      "source": "https://github.com/distillpub/template",
      "sourceLabel": "GitHub",
      "stars": 1001,
      "pushed": "2022-12-05",
      "embeddable": true,
      "thumb": "thumbs/distill.jpg",
      "rank": 23,
      "pick": false,
      "licenseNote": null
    },
    {
      "id": "astrowind",
      "name": "AstroWind",
      "vendor": "onWidget",
      "category": "landing",
      "pick": true,
      "preview": "https://astrowind.vercel.app/",
      "stack": [
        "Astro",
        "Tailwind CSS"
      ],
      "htmlReady": false,
      "license": "MIT",
      "pricing": "free",
      "desc": "무료·오픈소스 Astro + Tailwind 랜딩 템플릿입니다. 히어로·기능·가격·블로그 등 섹션 구성이 풍부합니다.",
      "tags": [
        "랜딩",
        "블로그",
        "섹션 다양"
      ],
      "more": [
        {
          "label": "Astro 테마 모음",
          "url": "https://astro.build/themes/"
        }
      ],
      "source": "https://github.com/onwidget/astrowind",
      "sourceLabel": "GitHub",
      "stars": 6021,
      "pushed": "2026-09-12",
      "embeddable": true,
      "thumb": "thumbs/astrowind.jpg",
      "rank": 24,
      "licenseNote": null
    },
    {
      "id": "cruip-open-pro",
      "name": "Open PRO",
      "vendor": "Cruip",
      "category": "landing",
      "preview": "https://open.cruip.com/",
      "stack": [
        "Next.js",
        "Tailwind CSS"
      ],
      "htmlReady": false,
      "license": "GPL-3.0",
      "pricing": "free",
      "licenseNote": "GPL-3.0(카피레프트): 수정본을 배포하면 소스 공개 의무가 생깁니다.",
      "desc": "어두운 배경의 SaaS 랜딩입니다. 제품 영상과 기능 소개 섹션이 돋보입니다.",
      "tags": [
        "다크",
        "SaaS",
        "영상"
      ],
      "more": [
        {
          "label": "Cruip 템플릿",
          "url": "https://cruip.com/"
        }
      ],
      "source": "https://github.com/cruip/open-react-template",
      "sourceLabel": "GitHub",
      "stars": 4705,
      "pushed": "2025-12-12",
      "embeddable": true,
      "thumb": "thumbs/cruip-open-pro.jpg",
      "rank": 25,
      "pick": false
    },
    {
      "id": "cruip-simple",
      "name": "Simple",
      "vendor": "Cruip",
      "category": "landing",
      "preview": "https://simple.cruip.com/",
      "stack": [
        "Next.js",
        "Tailwind CSS"
      ],
      "htmlReady": false,
      "license": "GPL-3.0",
      "pricing": "free",
      "licenseNote": "GPL-3.0(카피레프트): 수정본을 배포하면 소스 공개 의무가 생깁니다.",
      "desc": "밝고 단정한 SaaS 랜딩입니다. 여백이 넉넉해 제품·서비스 소개에 무난합니다.",
      "tags": [
        "라이트",
        "SaaS"
      ],
      "source": "https://github.com/cruip/tailwind-landing-page-template",
      "sourceLabel": "GitHub",
      "stars": 4511,
      "pushed": "2025-12-12",
      "embeddable": true,
      "thumb": "thumbs/cruip-simple.jpg",
      "rank": 26,
      "pick": false,
      "more": []
    },
    {
      "id": "html5up-massively",
      "name": "Massively",
      "vendor": "HTML5 UP",
      "category": "landing",
      "preview": "https://html5up.net/uploads/demos/massively/",
      "source": "https://html5up.net/massively",
      "stack": [
        "HTML",
        "CSS"
      ],
      "htmlReady": true,
      "license": "CC BY 3.0",
      "pricing": "free",
      "licenseNote": "CC BY 3.0: 무료지만 HTML5 UP 출처 표기가 필요합니다.",
      "desc": "사진 배경 히어로와 블로그형 카드 목록의 정적 HTML 템플릿입니다.",
      "tags": [
        "사진",
        "블로그",
        "정적 HTML"
      ],
      "more": [
        {
          "label": "HTML5 UP 전체",
          "url": "https://html5up.net/"
        }
      ],
      "sourceLabel": "홈페이지",
      "stars": null,
      "pushed": null,
      "embeddable": false,
      "thumb": "thumbs/html5up-massively.jpg",
      "rank": 27,
      "pick": false
    },
    {
      "id": "sb-agency",
      "name": "Agency",
      "vendor": "Start Bootstrap",
      "category": "landing",
      "preview": "https://startbootstrap.github.io/startbootstrap-agency/",
      "stack": [
        "Bootstrap 5"
      ],
      "htmlReady": true,
      "license": "MIT",
      "pricing": "free",
      "desc": "사진 히어로·서비스·포트폴리오·팀 섹션으로 구성된 정통 원페이지 템플릿입니다.",
      "tags": [
        "원페이지",
        "포트폴리오"
      ],
      "more": [
        {
          "label": "Start Bootstrap 테마",
          "url": "https://startbootstrap.com/themes"
        }
      ],
      "source": "https://github.com/StartBootstrap/startbootstrap-agency",
      "sourceLabel": "GitHub",
      "stars": 2033,
      "pushed": "2024-07-15",
      "embeddable": true,
      "thumb": "thumbs/sb-agency.jpg",
      "rank": 28,
      "pick": false,
      "licenseNote": null
    },
    {
      "id": "salient",
      "name": "Salient",
      "vendor": "Tailwind Labs",
      "category": "landing",
      "preview": "https://salient.tailwindui.com/",
      "source": null,
      "stack": [
        "Next.js",
        "Tailwind CSS"
      ],
      "htmlReady": false,
      "license": "상용",
      "pricing": "paid",
      "licenseNote": "상용 제품입니다. 구매 전에는 디자인 참고용으로만 보세요. (Tailwind Plus)",
      "desc": "Tailwind CSS 제작사의 SaaS 랜딩 템플릿입니다(데모 브랜드: TaxPal).",
      "tags": [
        "SaaS",
        "Tailwind Plus"
      ],
      "sourceLabel": "홈페이지",
      "stars": null,
      "pushed": null,
      "embeddable": true,
      "thumb": "thumbs/salient.jpg",
      "rank": 29,
      "pick": false,
      "more": []
    },
    {
      "id": "radiant",
      "name": "Radiant",
      "vendor": "Tailwind Labs",
      "category": "landing",
      "preview": "https://radiant.tailwindui.com/",
      "source": null,
      "stack": [
        "Next.js",
        "Tailwind CSS"
      ],
      "htmlReady": false,
      "license": "상용",
      "pricing": "paid",
      "licenseNote": "상용 제품입니다. 구매 전에는 디자인 참고용으로만 보세요. (Tailwind Plus)",
      "desc": "화사한 그라데이션의 B2B SaaS 랜딩 템플릿입니다.",
      "tags": [
        "그라데이션",
        "B2B",
        "Tailwind Plus"
      ],
      "sourceLabel": "홈페이지",
      "stars": null,
      "pushed": null,
      "embeddable": true,
      "thumb": "thumbs/radiant.jpg",
      "rank": 30,
      "pick": false,
      "more": []
    },
    {
      "id": "revealjs",
      "name": "reveal.js",
      "vendor": "Hakim El Hattab",
      "category": "slides",
      "pick": true,
      "preview": "https://revealjs.com/demo/",
      "stack": [
        "HTML",
        "JavaScript"
      ],
      "htmlReady": true,
      "license": "MIT",
      "pricing": "free",
      "desc": "HTML 슬라이드의 표준입니다. 결과물을 발표 자료로 만들 때 가장 먼저 검토할 도구입니다.",
      "tags": [
        "슬라이드",
        "발표"
      ],
      "more": [
        {
          "label": "테마",
          "url": "https://revealjs.com/themes/"
        }
      ],
      "source": "https://github.com/hakimel/reveal.js",
      "sourceLabel": "GitHub",
      "stars": 72381,
      "pushed": "2026-09-30",
      "embeddable": true,
      "thumb": "thumbs/revealjs.jpg",
      "rank": 31,
      "licenseNote": null
    },
    {
      "id": "slidev",
      "name": "Slidev",
      "vendor": "Slidev",
      "category": "slides",
      "preview": "https://sli.dev/demo/starter/",
      "stack": [
        "Vue",
        "Markdown"
      ],
      "htmlReady": false,
      "license": "MIT",
      "pricing": "free",
      "desc": "Markdown으로 쓰는 개발자용 슬라이드입니다. 코드 하이라이트와 다이어그램 표현에 강합니다.",
      "tags": [
        "Markdown",
        "코드",
        "개발자"
      ],
      "more": [
        {
          "label": "테마 갤러리",
          "url": "https://sli.dev/resources/theme-gallery"
        }
      ],
      "source": "https://github.com/slidevjs/slidev",
      "sourceLabel": "GitHub",
      "stars": 48923,
      "pushed": "2026-10-02",
      "embeddable": true,
      "thumb": "thumbs/slidev.jpg",
      "rank": 32,
      "pick": false,
      "licenseNote": null
    },
    {
      "id": "impressjs",
      "name": "impress.js",
      "vendor": "impress.js",
      "category": "slides",
      "preview": "https://impress.js.org/",
      "stack": [
        "HTML",
        "JavaScript"
      ],
      "htmlReady": true,
      "license": "MIT",
      "pricing": "free",
      "desc": "Prezi처럼 화면이 3D 공간을 이동하는 발표 도구입니다. 임팩트 있는 연출이 필요할 때 씁니다.",
      "tags": [
        "3D",
        "연출"
      ],
      "source": "https://github.com/impress/impress.js",
      "sourceLabel": "GitHub",
      "stars": 38155,
      "pushed": "2026-07-23",
      "embeddable": true,
      "thumb": "thumbs/impressjs.jpg",
      "rank": 33,
      "pick": false,
      "more": [],
      "licenseNote": null
    },
    {
      "id": "echarts",
      "name": "Apache ECharts",
      "vendor": "Apache",
      "category": "charts",
      "pick": true,
      "preview": "https://echarts.apache.org/examples/en/index.html",
      "stack": [
        "JavaScript"
      ],
      "htmlReady": true,
      "license": "Apache-2.0",
      "pricing": "free",
      "desc": "차트 종류와 예제가 가장 풍부한 라이브러리입니다. 대시보드형 결과물의 기본 차트로 추천합니다.",
      "tags": [
        "차트",
        "지도",
        "대용량"
      ],
      "source": "https://github.com/apache/echarts",
      "sourceLabel": "GitHub",
      "stars": 67451,
      "pushed": "2026-10-04",
      "embeddable": false,
      "thumb": "thumbs/echarts.jpg",
      "rank": 34,
      "more": [],
      "licenseNote": null
    },
    {
      "id": "chartjs",
      "name": "Chart.js",
      "vendor": "Chart.js",
      "category": "charts",
      "preview": "https://www.chartjs.org/",
      "stack": [
        "JavaScript"
      ],
      "htmlReady": true,
      "license": "MIT",
      "pricing": "free",
      "desc": "가볍고 배우기 쉬운 기본 차트 라이브러리입니다. 단일 HTML 파일에 CDN 한 줄로 넣기 좋습니다.",
      "tags": [
        "가벼운",
        "기본 차트"
      ],
      "more": [
        {
          "label": "샘플 모음",
          "url": "https://www.chartjs.org/docs/latest/samples/information.html"
        }
      ],
      "source": "https://github.com/chartjs/Chart.js",
      "sourceLabel": "GitHub",
      "stars": 67737,
      "pushed": "2026-10-04",
      "embeddable": true,
      "thumb": "thumbs/chartjs.jpg",
      "rank": 35,
      "pick": false,
      "licenseNote": null
    },
    {
      "id": "plotly",
      "name": "Plotly.js",
      "vendor": "Plotly",
      "category": "charts",
      "preview": "https://plotly.com/javascript/",
      "stack": [
        "JavaScript"
      ],
      "htmlReady": true,
      "license": "MIT",
      "pricing": "free",
      "desc": "확대·호버가 기본인 인터랙티브 차트입니다. Python(Plotly) 분석 결과와 모양을 맞추기 좋습니다.",
      "tags": [
        "인터랙티브",
        "과학",
        "Python"
      ],
      "source": "https://github.com/plotly/plotly.js",
      "sourceLabel": "GitHub",
      "stars": 18356,
      "pushed": "2026-10-05",
      "embeddable": true,
      "thumb": "thumbs/plotly.jpg",
      "rank": 36,
      "pick": false,
      "more": [],
      "licenseNote": null
    },
    {
      "id": "observable-plot",
      "name": "Observable Plot",
      "vendor": "Observable",
      "category": "charts",
      "preview": "https://observablehq.github.io/plot/",
      "stack": [
        "JavaScript"
      ],
      "htmlReady": true,
      "license": "ISC",
      "pricing": "free",
      "desc": "D3를 만든 팀(Observable)의 탐색적 시각화 라이브러리입니다. 짧은 코드로 깔끔한 기본 스타일의 차트를 만듭니다.",
      "tags": [
        "탐색적 분석",
        "D3"
      ],
      "source": "https://github.com/observablehq/plot",
      "sourceLabel": "GitHub",
      "stars": 5401,
      "pushed": "2026-09-01",
      "embeddable": true,
      "thumb": "thumbs/observable-plot.jpg",
      "rank": 37,
      "pick": false,
      "more": [],
      "licenseNote": null
    },
    {
      "id": "apexcharts",
      "name": "ApexCharts",
      "vendor": "ApexCharts",
      "category": "charts",
      "preview": "https://apexcharts.com/javascript-chart-demos/",
      "stack": [
        "JavaScript"
      ],
      "htmlReady": true,
      "license": "듀얼 라이선스",
      "pricing": "conditional",
      "licenseNote": "연매출·예산이 200만 달러 이상인 조직은 상용 라이선스가 필요합니다(사내 사용 포함).",
      "desc": "애니메이션이 매끄러운 모던 차트 라이브러리입니다. 다만 대기업에서 쓰려면 유료 라이선스가 필요합니다.",
      "tags": [
        "애니메이션",
        "모던"
      ],
      "more": [
        {
          "label": "라이선스·가격",
          "url": "https://apexcharts.com/pricing/"
        }
      ],
      "source": "https://github.com/apexcharts/apexcharts.js",
      "sourceLabel": "GitHub",
      "stars": 15169,
      "pushed": "2026-10-04",
      "embeddable": true,
      "thumb": "thumbs/apexcharts.jpg",
      "rank": 38,
      "pick": false
    },
    {
      "id": "bootstrap-examples",
      "name": "Bootstrap 공식 예제",
      "vendor": "Bootstrap",
      "category": "uikit",
      "pick": true,
      "preview": "https://getbootstrap.com/docs/5.3/examples/",
      "stack": [
        "Bootstrap 5"
      ],
      "htmlReady": true,
      "license": "MIT",
      "pricing": "free",
      "desc": "대시보드·앨범·가격표·체크아웃 등 공식 예제 모음입니다. Bootstrap 기반 결과물의 기본 문법을 익히기 좋습니다.",
      "tags": [
        "공식",
        "예제"
      ],
      "more": [
        {
          "label": "Dashboard 예제",
          "url": "https://getbootstrap.com/docs/5.3/examples/dashboard/"
        }
      ],
      "source": "https://github.com/twbs/bootstrap",
      "sourceLabel": "GitHub",
      "stars": 174985,
      "pushed": "2026-10-06",
      "embeddable": true,
      "thumb": "thumbs/bootstrap-examples.jpg",
      "rank": 39,
      "licenseNote": null
    },
    {
      "id": "shadcn-blocks",
      "name": "shadcn/ui Blocks",
      "vendor": "shadcn",
      "category": "uikit",
      "preview": "https://ui.shadcn.com/blocks",
      "stack": [
        "React",
        "Tailwind CSS"
      ],
      "htmlReady": false,
      "license": "MIT",
      "pricing": "free",
      "desc": "대시보드·사이드바·로그인 등 바로 붙여 쓰는 shadcn/ui 블록 모음입니다.",
      "tags": [
        "블록",
        "모던"
      ],
      "source": "https://github.com/shadcn-ui/ui",
      "sourceLabel": "GitHub",
      "stars": 125122,
      "pushed": "2026-10-05",
      "embeddable": true,
      "thumb": "thumbs/shadcn-blocks.jpg",
      "rank": 40,
      "pick": false,
      "more": [],
      "licenseNote": null
    },
    {
      "id": "daisyui",
      "name": "daisyUI",
      "vendor": "Pouya Saadeghi",
      "category": "uikit",
      "preview": "https://daisyui.com/components/",
      "stack": [
        "Tailwind CSS"
      ],
      "htmlReady": true,
      "license": "MIT",
      "pricing": "free",
      "desc": "클래스 이름만으로 컴포넌트를 만드는 Tailwind 플러그인입니다. 테마 전환이 쉬워 결과물 색상을 바꾸기 좋습니다.",
      "tags": [
        "테마",
        "컴포넌트"
      ],
      "source": "https://github.com/saadeghi/daisyui",
      "sourceLabel": "GitHub",
      "stars": 42545,
      "pushed": "2026-09-30",
      "embeddable": true,
      "thumb": "thumbs/daisyui.jpg",
      "rank": 41,
      "pick": false,
      "more": [],
      "licenseNote": null
    },
    {
      "id": "flowbite",
      "name": "Flowbite",
      "vendor": "Themesberg",
      "category": "uikit",
      "preview": "https://flowbite.com/blocks/",
      "stack": [
        "Tailwind CSS"
      ],
      "htmlReady": true,
      "license": "MIT",
      "pricing": "mixed",
      "licenseNote": "라이브러리는 MIT, 일부 블록은 Pro(유료)입니다.",
      "desc": "Tailwind CSS 컴포넌트·블록 모음입니다.",
      "tags": [
        "컴포넌트",
        "블록"
      ],
      "source": "https://github.com/themesberg/flowbite",
      "sourceLabel": "GitHub",
      "stars": 9368,
      "pushed": "2026-06-27",
      "embeddable": true,
      "thumb": "thumbs/flowbite.jpg",
      "rank": 42,
      "pick": false,
      "more": []
    },
    {
      "id": "preline",
      "name": "Preline UI",
      "vendor": "Htmlstream",
      "category": "uikit",
      "preview": "https://preline.co/blocks/",
      "stack": [
        "Tailwind CSS"
      ],
      "htmlReady": true,
      "license": "MIT",
      "pricing": "mixed",
      "licenseNote": "라이브러리는 MIT, 블록·템플릿 일부는 프리미엄(유료)입니다.",
      "desc": "Tailwind CSS 블록·템플릿 모음입니다.",
      "tags": [
        "블록",
        "템플릿"
      ],
      "source": "https://github.com/htmlstreamofficial/preline",
      "sourceLabel": "GitHub",
      "stars": 6472,
      "pushed": "2026-08-31",
      "embeddable": true,
      "thumb": "thumbs/preline.jpg",
      "rank": 43,
      "pick": false,
      "more": []
    },
    {
      "id": "carbon",
      "name": "Carbon Design System",
      "vendor": "IBM",
      "category": "uikit",
      "preview": "https://www.carbondesignsystem.com/",
      "stack": [
        "Web Components",
        "React"
      ],
      "htmlReady": false,
      "license": "Apache-2.0",
      "pricing": "free",
      "desc": "IBM의 엔터프라이즈 디자인 시스템입니다. 데이터 표와 폼이 많은 업무형 결과물에 어울립니다.",
      "tags": [
        "엔터프라이즈",
        "디자인 시스템",
        "표"
      ],
      "source": "https://github.com/carbon-design-system/carbon",
      "sourceLabel": "GitHub",
      "stars": 9521,
      "pushed": "2026-10-06",
      "embeddable": true,
      "thumb": "thumbs/carbon.jpg",
      "rank": 44,
      "pick": false,
      "more": [],
      "licenseNote": null
    }
  ]
};
