declare module "pdfmake/build/pdfmake" {
  const pdfMake: {
    vfs: Record<string, string>;
  };
  export default pdfMake;
}

declare module "pdfmake/build/vfs_fonts" {
  const pdfFonts: {
    vfs: Record<string, string>;
  };
  export default pdfFonts;
}
