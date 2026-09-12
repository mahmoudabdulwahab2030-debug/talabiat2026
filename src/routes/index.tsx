import { createFileRoute, redirect } from "@tanstack/react-router";

// الصفحة الرئيسية تفتح صفحة تسجيل الدخول الأصلية للمشروع (public/index.html)
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "نظام الأوردرات والمخازن — لودو" },
      {
        name: "description",
        content: "نظام إدارة الأوردرات والفروع والمخازن والحجوزات والتقارير.",
      },
      { property: "og:title", content: "نظام الأوردرات والمخازن — لودو" },
      {
        property: "og:description",
        content: "نظام إدارة الأوردرات والفروع والمخازن والحجوزات والتقارير.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ href: "/login.html" });
  },
  component: () => null,
});
