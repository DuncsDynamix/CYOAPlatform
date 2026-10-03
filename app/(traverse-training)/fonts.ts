import { Inter, Lato, Montserrat, Nunito_Sans, Open_Sans, Source_Serif_4 } from "next/font/google"

/**
 * The curated brand-pack fonts (FONT_KEYS in lib/training/brand-pack.ts),
 * self-hosted by next/font: no runtime request to Google. Each defines a
 * --tg-ff-<key> variable; brandTokens() points --tg-font-heading and
 * --tg-font-body at two of them. preload is off, so a page downloads only
 * the faces its text actually uses. Part of the token layer: the only
 * place outside tokens.css that names a font.
 */
const montserrat = Montserrat({ subsets: ["latin"], display: "swap", preload: false, variable: "--tg-ff-montserrat" })
const openSans = Open_Sans({ subsets: ["latin"], display: "swap", preload: false, variable: "--tg-ff-open-sans" })
const inter = Inter({ subsets: ["latin"], display: "swap", preload: false, variable: "--tg-ff-inter" })
const sourceSerif = Source_Serif_4({ subsets: ["latin"], display: "swap", preload: false, variable: "--tg-ff-source-serif-4" })
const lato = Lato({ subsets: ["latin"], weight: ["400", "700"], display: "swap", preload: false, variable: "--tg-ff-lato" })
const nunitoSans = Nunito_Sans({ subsets: ["latin"], display: "swap", preload: false, variable: "--tg-ff-nunito-sans" })

export const fontVariables = [montserrat, openSans, inter, sourceSerif, lato, nunitoSans].map((f) => f.variable).join(" ")
