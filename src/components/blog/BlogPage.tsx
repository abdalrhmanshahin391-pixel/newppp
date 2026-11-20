import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { UzyraWordmark } from "@/components/brand/UzyraWordmark";
import { HeaderResourcesMenu } from "@/components/header/HeaderResourcesMenu";
import { useUiLanguage } from "@/components/language/useUiLanguage";
import "./blog.css";

const articlePath = "/blog/from-page-to-practice";

export function BlogPage({ article = false }: { article?: boolean }) {
  const ar = useUiLanguage() === "ar";
  const [open, setOpen] = useState(false);
  const blog = ar ? "المدونة" : "Blog";
  const title = ar
    ? "من صفحة في كتاب إلى جملة تستخدمها"
    : "From a page in a book to a phrase you can use";
  const summary = ar
    ? "طريقة بسيطة لنقل جملة من قراءتك اليومية إلى محادثتك القادمة."
    : "A simple way to take a sentence from your reading into your next conversation.";
  const cover = (
    <div className="ub-cover">
      <img
        src="/media/blog/library.jpg"
        width="1024"
        height="684"
        alt={
          ar
            ? "شرفات خشبية تطل على طوابق المكتبة"
            : "Curved wooden balconies overlooking the library shelves"
        }
      />
      <span>
        <UzyraWordmark size={22} />
      </span>
    </div>
  );
  return (
    <div className="ub-page" dir={ar ? "rtl" : "ltr"} lang={ar ? "ar" : "en"}>
      <header className="ub-header uz-header-shell">
        <Link to="/" aria-label={ar ? "يوزرا الرئيسية" : "Uzyra home"}>
          <UzyraWordmark size={16} />
        </Link>
        <nav className="uz-header-nav" aria-label={ar ? "التنقل" : "Navigation"}>
          <Link className="ub-wide uz-header-link" to="/books">
            {ar ? "المكتبة" : "Library"}
          </Link>
          <Link className="ub-wide uz-header-link" to="/pricing">
            {ar ? "الأسعار" : "Pricing"}
          </Link>
          <HeaderResourcesMenu arabic={ar} open={open} onOpenChange={setOpen} showMobilePricing />
        </nav>
        <Link className="ub-cta" to="/start">
          {ar ? "ابدأ التعلّم" : "Start learning"}
        </Link>
      </header>
      <main className="ub-main">
        {article ? (
          <Link className="ub-return" to="/blog">
            {ar ? "→ المدونة" : "← Blog"}
          </Link>
        ) : (
          <h1>{blog}</h1>
        )}
        <article className="ub-row">
          <time dateTime="2026-11-20">{ar ? "٢٠ نوفمبر ٢٠٢٦" : "November 20, 2026"}</time>
          <div>
            {article ? (
              cover
            ) : (
              <Link to={articlePath} aria-label={title}>
                {cover}
              </Link>
            )}
            {article ? (
              <h1 className="ub-title">{title}</h1>
            ) : (
              <h2 className="ub-title">
                <Link to={articlePath}>{title}</Link>
              </h2>
            )}
            <p className="ub-summary">{summary}</p>
            {article ? (
              <div className="ub-copy">
                <p>
                  {ar
                    ? "وأنت تقرأ، اختَر جملة تتخيّل نفسك تقولها لشخص تعرفه. مثلًا، لو صادفت جملة I’m looking for a book، اقرأها بصوت عالٍ ثم أغلق الصفحة."
                    : "As you read, pick one sentence you could imagine saying to someone you know. If you come across “I’m looking for a book,” read it aloud, then close the page."}
                </p>
                <p>
                  {ar
                    ? "تخيّل أنك في المكتبة وتسأل عن كتاب. جرّب تقول الجملة من ذاكرتك، وبعدها افتح الصفحة وقارن. غيّر كلمة واحدة وجرّب مرة ثانية. ماذا ستقول لو كنت تبحث عن قاموس؟"
                    : "Picture yourself at the library desk. Say the sentence from memory, then check it against the page. Change one word and try again. What would you say if you were looking for a dictionary?"}
                </p>
                <Link to="/books">{ar ? "افتح مكتبة يوزرا ←" : "Open the Uzyra library →"}</Link>
              </div>
            ) : (
              <Link className="ub-read" to={articlePath}>
                {ar ? "اقرأ المقال ←" : "Read →"}
              </Link>
            )}
          </div>
        </article>
      </main>
    </div>
  );
}
