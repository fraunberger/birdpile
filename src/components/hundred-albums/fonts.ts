import { Libre_Franklin, Newsreader } from "next/font/google";

/** Text and headlines: a serif drawn for reading on screens, with optical sizes. */
export const serif = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-newsreader",
  display: "swap",
});

/** Labels and buttons, in the newspaper's Franklin Gothic tradition. */
export const sans = Libre_Franklin({
  subsets: ["latin"],
  variable: "--font-franklin",
  display: "swap",
});
