export type HeaderLayout = {
  height: "compact" | "standard" | "tall";
  background: string;
  textColor: string;
  sticky: boolean;
  menuId: string | null;
};

export type FooterColumn = {
  heading: string;
  widgetId: string | null;
};

export type FooterLayout = {
  background: string;
  textColor: string;
  style: "simple" | "columns" | "centered";
  copyright: string;
  credit: string;
  columns: FooterColumn[];
};

export const defaultHeaderLayout: HeaderLayout = {
  height: "standard",
  background: "#f4eee6",
  textColor: "#17324d",
  sticky: false,
  menuId: null
};

export const defaultFooterLayout: FooterLayout = {
  background: "#17324d",
  textColor: "#ffffff",
  style: "columns",
  copyright: "",
  credit: "",
  columns: [
    { heading: "", widgetId: null },
    { heading: "", widgetId: null },
    { heading: "", widgetId: null }
  ]
};
