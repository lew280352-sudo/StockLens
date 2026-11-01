// Exercise the same floating navigation on desktop and mobile.
export async function navigateUI(page,destination){
 const primary=page.locator(`.app-dock [data-page=${destination}]`);
 if(await primary.count())await primary.click();
 else{await page.locator('[data-mobile-more]').click();await page.locator(`#mobile-menu [data-page=${destination}]`).click();}
}
