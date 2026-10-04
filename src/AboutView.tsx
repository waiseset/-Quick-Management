import { openItem } from "../api";
import { useApp } from "../store";

/** 参考文档「详情页」（关于）：开发者信息与赞助，超链接文字单独着色 */
const LINKS = {
  github: "https://github.com/waiseset",
  qq: "https://qm.qq.com/q/j2VgeBsrCg",
  sponsor: "https://waiseset.github.io/waiseset/images/%E8%B5%9E%E5%8A%A9.jpg",
};

export function AboutView() {
  const { showToast } = useApp();

  const openLink = (href: string) => {
    void openItem("url", href).catch((error: unknown) =>
      showToast(typeof error === "string" ? error : "无法打开链接"),
    );
  };

  const link = (text: string, href: string) => (
    <a
      className="link"
      href={href}
      onClick={(event) => {
        event.preventDefault();
        openLink(href);
      }}
    >
      {text}
    </a>
  );

  return (
    <section className="view">
      <div className="view-body">
        <div className="panel about-panel">
          <h2 className="panel-title">关于</h2>
          <dl className="about-list">
            <div className="about-row">
              <dt>开发者</dt>
              <dd>waiseset</dd>
            </div>
            <div className="about-row">
              <dt>开发者：Github</dt>
              <dd>{link("Github", LINKS.github)}</dd>
            </div>
            <div className="about-row">
              <dt>开发者：QQ</dt>
              <dd>{link("QQ", LINKS.qq)}</dd>
            </div>
            <div className="about-row">
              <dt>赞助</dt>
              <dd>{link("赞助", LINKS.sponsor)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
