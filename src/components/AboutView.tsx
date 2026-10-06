import { openItem } from "../api";
import { useApp } from "../store";
import { APP_VERSION, PROJECT_URL } from "../util";

/** 参考文档「详情页」：开发者信息；2.0 起不再放 QQ 与赞助，改为版本号与简介 */
export function AboutView() {
  const { showToast } = useApp();

  const link = (text: string, href: string) => (
    <a
      className="link"
      href={href}
      onClick={(event) => {
        event.preventDefault();
        void openItem("url", href).catch((error: unknown) =>
          showToast(typeof error === "string" ? error : "无法打开链接"),
        );
      }}
    >
      {text}
    </a>
  );

  return (
    <section className="view">
      <div className="view-body">
        <div className="panel about-panel">
          <h2 className="panel-title">快捷管理 {APP_VERSION}</h2>
          <p className="panel-text">
            把常用的应用、网址和文件分门别类收进一个窗口：单击看描述、双击直接打开。
            支持分类与二级分类、多选与批量操作、图标自动提取、从资源管理器拖入添加、
            数据导入导出、路径失效提醒，以及需要密码才能进入的隐藏区。
          </p>
          <p className="panel-text">
            所有数据都保存在你自己的电脑上，不联网也能正常使用。
          </p>
          <dl className="about-list">
            <div className="about-row">
              <dt>版本</dt>
              <dd>{APP_VERSION}</dd>
            </div>
            <div className="about-row">
              <dt>开发者</dt>
              <dd>waiseset</dd>
            </div>
            <div className="about-row">
              <dt>项目主页</dt>
              <dd>{link("github.com/waiseset/Quick-Management", PROJECT_URL)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
