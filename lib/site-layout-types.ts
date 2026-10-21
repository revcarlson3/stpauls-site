export type HeaderLayout = {
  height: "compact" | "standard" | "tall";
  background: string;
  textColor: string;
  sticky: boolean;
  stylistic: boolean;
  menuId: string | null;
  preHeader: {
    enabled: boolean;
    text: string;
    menuId: string | null;
  };
};

export type FooterColumn = {
  heading: string;
  widgetId: string | null;
  alignment: "left" | "center" | "right";
};

export type FooterLayout = {
  background: string;
  textColor: string;
  style: "simple" | "columns" | "centered";
  copyright: string;
  credit: string;
  columns: FooterColumn[];
  columnDividers: boolean;
};

export const defaultHeaderLayout: HeaderLayout = {
  height: "standard",
  background: "#f4eee6",
  textColor: "#17324d",
  sticky: false,
  stylistic: false,
  menuId: null,
  preHeader: {
    enabled: false,
    text: "",
    menuId: null
  }
};

export const defaultFooterLayout: FooterLayout = {
  background: "#17324d",
  textColor: "#ffffff",
  style: "columns",
  copyright: "",
  credit: "",
  columnDividers: false,
  columns: [
    { heading: "", widgetId: null, alignment: "left" },
    { heading: "", widgetId: null, alignment: "left" },
    { heading: "", widgetId: null, alignment: "left" }
  ]
};
