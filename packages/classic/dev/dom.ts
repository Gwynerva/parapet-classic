/** Small DOM helpers of the development pages. */

/** The page's element with `id` (the pages are ours: it is there). */
export const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
