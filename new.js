// ==UserScript==
// @name         gamot share
// @namespace    lvmao
// @version      2026-05-29
// @description  gamot qol
// @author       anri
// @match        *://*/dashboard/claims/print/*
// @match        *://*/dashboard/validation/view/*
// @match        *://*/dashboard/claims/view/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=26.175
// @sandbox      raw
// @connect      gamot.philhealth.gov.ph
// @grant        GM.xmlHttpRequest
// @grant        GM_xmlhttpRequest
// ==/UserScript==

/* ============================================================================
 * CONFIG
 * These values control behavior across every page the script runs on.
 * ==========================================================================*/

// PhilHealth GAMOT Claims Report
const name = "Aldrin M. Deleña"        // Printed as "Adjudicated by: <name>" on the print page
const fontSize = 20        // Font size (px) for that adjudicator stamp

// Master switches for the three big features further down the script
const extraFeatKo = true;      // keyboard shortcuts + "open all" cross-check button (claims/view + validation/view)
const extraFeatAvail = true    // dispensing-limit column + duplicate/price checks (availment_form page)
const extraFeatPres = true     // anti-infectious labeling (prescription page)


/* ============================================================================
 * HELPER: checkAllPassGatn
 * Scans a validation report's result rows and returns true only if every
 * row (after the header row) says "PASS". Reused on both the validation
 * page and inside the "open all" cross-check on the claims list page.
 * ==========================================================================*/
function checkAllPassGatn(document){
    const sec = document.querySelector("#validation-report-view > section:nth-child(9)")
    const rowsSec = sec.querySelectorAll("div.row")
    for(let i = 1; i<rowsSec.length; i++){   // start at 1 to skip the header row
        const row = rowsSec[i]
        const result = row.querySelector("div:last-child > p").innerText
        if(result!=="PASS"){
            return false
        }
    }
    return true
}


/* ============================================================================
 * SECTION 1: /dashboard/claims/print/*
 * Auto-renames the tab/print title to the claim number, stamps the
 * adjudicator's name at the bottom of the printed page, then triggers
 * print immediately. This is the "rename file on print" behavior.
 * ==========================================================================*/
if(window.location.pathname.indexOf("/dashboard/claims/print")>=0){
    // Pull claim number (GACN) from the breadcrumb and use it as the doc title
    const gacn = document.querySelector("#breadcrumb_header > li:nth-child(2)").innerText
    document.title = gacn

    // Build and inject the "Adjudicated by: NAME" line at the bottom of the printout
    const appendDiv = document.createElement("div")
    appendDiv.setAttribute("style", "display: flex; align-items: left; justify-content: center;flex-direction: column !important;")
    const appendP = document.createElement("p")
    appendP.setAttribute("style", `font-size:${fontSize}px`)
    appendP.appendChild(document.createTextNode(`Adjudicated by: ${name}`))
    const appendSpan = document.createElement("span")
    appendSpan.appendChild(appendP)
    appendDiv.appendChild(appendSpan)
    const last = document.querySelector("#printArea > div.content > div:last-child")
    last.after(appendDiv)

    // Fire the browser print dialog automatically
    window.print()
}


/* ============================================================================
 * SECTION 2: /dashboard/validation/view/*
 * Renames the tab title to the claim tracking number (GATN) and adds two
 * keyboard shortcuts for quick QA and data capture.
 * ==========================================================================*/
if(window.location.pathname.indexOf("/dashboard/validation/view")>=0){
    const gatn = document.querySelector("body > div.base-layout > div:nth-child(3) > div > div:nth-child(1) > h4").innerText
    document.title = gatn

    if(extraFeatKo){
        window.addEventListener('keyup', function (e) {

            // --- Shortcut: ` (backtick) -> run the all-PASS check ---
            if(e.key == '`'){
                if(checkAllPassGatn(document)){
                    alert("Pass")
                }else{
                    alert("REVIEW REVIEW REVIEW")
                }
            }

            // --- Shortcut: 1 -> copy "GATN <tab> beneficiary name" to clipboard ---
            if(e.key == '1'){
                const nameBenef = document.querySelector("#validation-report-view > section:nth-child(3) > div:nth-child(1) > p").innerText
                const gatn = document.querySelector("body > div.base-layout > div:nth-child(3) > div > div:nth-child(1) > h4").innerText
                const strOut = `${gatn}	${nameBenef}`
                // Uses a hidden textarea + execCommand("copy") as the clipboard trick
                const tempTexArea = document.createElement("textarea")
                document.body.appendChild(tempTexArea)
                tempTexArea.innerText = strOut
                tempTexArea.select()
                document.execCommand("copy")
                document.body.removeChild(tempTexArea)
                alert("Copied")
            }
        }, true)
    }
}


/* ============================================================================
 * SECTION 3: /dashboard/claims/view/*  (list page only — excludes the
 * prescription and availment_form sub-pages, which get their own sections)
 *
 * Adds:
 *   - ` shortcut to trigger the page's own print button
 *   - an "open all" column/button per claim row that opens every related
 *     document (attachments, GVR, availment form, prescription) in new
 *     tabs, scrapes beneficiary info from each, cross-checks consistency,
 *     and shows a single summary alert.
 * ==========================================================================*/
if(window.location.pathname.indexOf("/dashboard/claims/view")>=0 && extraFeatKo && window.location.pathname.indexOf("/dashboard/claims/view/prescription")<0 && window.location.pathname.indexOf("/dashboard/claims/view/availment_form")<0){

    // --- Shortcut: ` -> click the built-in print button ---
    window.addEventListener('keydown', async function (e) {
        if(e.key == '`'){
            const butPrint = document.querySelector("#printButton")
            butPrint.click()
        }
    }, true)

    // --- Add open all header column to the claims table ---
    const gatnTable = document.querySelector("#page-content-wrapper > div > div.container-fluid > div.card.mb-3 > div.card-body.p-0.table-responsive.table-responsive-sm.custom-table-wrapper > table")
    const header = gatnTable.querySelector("thead")
    const thBut = document.createElement("th")
    thBut.setAttribute("scope","col")
    thBut.innerText = "All Docs"
    header.querySelector("tr").appendChild(thBut)

    // --- Build one "open all + cross-check" button per row ---
    const rows = gatnTable.querySelector("tbody").rows
    for(let i = 0; i<rows.length; i++){
        const row = rows[i]

        // Pull this row's claim number and the links to its related documents
        const gatn = row.querySelector("td:nth-child(1) > a").innerText
        const linkGVR = row.querySelector("td:nth-child(1) > a").getAttribute("href")
        const linkAvail = row.querySelector("td:nth-child(10) > a").getAttribute("href")
        const linkPres = row.querySelector("td:nth-child(11) > a").getAttribute("href")
        const tdAtt = row.querySelector("td:nth-child(12) > div")
        const linkAttArr = tdAtt ? row.querySelectorAll("td:nth-child(12) > div > a") : null

        const but = document.createElement("button")
        but.setAttribute("class", "no-loader")
        but.innerText = gatn
        but.addEventListener("click", async () => {

            // Open every attachment in its own tab
            if(linkAttArr){
                for(let i = 0; i<linkAttArr.length; i++){
                    const linkAtt = linkAttArr[i].getAttribute("href")
                    window.open(linkAtt)
                }
            }
            // Open the three main documents for this claim
            const winGVR = window.open(linkGVR)
            const winAvail = window.open(linkAvail)
            const winPres = window.open(linkPres)

            // Small utility: wait for a newly-opened window to finish loading,
            // then read the text of one element inside it (or null if missing)
            function queryInnerTextPromise(win, query){
                return new Promise((resolve, reject) => {
                    win.addEventListener("load", (event) =>{
                        const element = win.document.querySelector(query)
                        if(!element){
                            resolve(null)
                            return
                        }
                        const result = element.innerText.trim()
                        resolve(result)
                        return
                    })
                })
            }

            // --- Scrape beneficiary fields from the GVR (validation report) tab ---
            const benefNamePromise = queryInnerTextPromise(winGVR, "#validation-report-view > section:nth-child(3) > div:nth-child(1) > p")
            const benefAgePromise = queryInnerTextPromise(winGVR, "#validation-report-view > section:nth-child(3) > div:nth-child(4) > div:nth-child(2) > div:nth-child(1) > p")
            const benefSexPromise = queryInnerTextPromise(winGVR, "#validation-report-view > section:nth-child(3) > div:nth-child(4) > div:nth-child(2) > div:nth-child(2) > p")
            const passGVRPromise = new Promise((resolve, reject)=>{
                winGVR.addEventListener("load", (event) =>{
                    resolve(checkAllPassGatn(winGVR.document))
                })
            })

            // --- Scrape the same fields from the Availment Form tab ---
            const benefNameAvailPromise = queryInnerTextPromise(winAvail, "#availmentForm > div:nth-child(9) > div:nth-child(1) > div:nth-child(3) > span")
            const nameSignAvailPromise = queryInnerTextPromise(winAvail, "#availmentNameDisplay")
            const benefAgeAvailPromise = queryInnerTextPromise(winAvail, "#availmentForm > div:nth-child(9) > div:nth-child(2) > div:nth-child(3) > span:nth-child(2)")
            const benefSexAvailPromise = queryInnerTextPromise(winAvail, "#availmentForm > div:nth-child(9) > div:nth-child(2) > div:nth-child(3) > span:nth-child(4)")
            const benefAmtAvailPromise = queryInnerTextPromise(winAvail, "#availmentForm > div:nth-child(9) > div:nth-child(2) > div:nth-child(3) > span:nth-child(4)")
            const benefMessAvailPromise = queryInnerTextPromise(winAvail, "#uploadedIdMessage")

            // --- Scrape the same fields from the Prescription tab ---
            const benefNamePresPromise = queryInnerTextPromise(winPres, "#basic-details > div.row.no-border.mt-2 > div > div > span")
            const benefAgePresPromise = queryInnerTextPromise(winPres, "#basic-details > div.row.no-border.justify-content-end > div:nth-child(1) > div > span")
            const benefSexPresPromise = queryInnerTextPromise(winPres, "#basic-details > div.row.no-border.justify-content-end > div:nth-child(2) > div > span")

            // Wait for every scrape to finish before comparing
            const [benefName, benefAge, benefSex, passGVR, benefNameAvail, nameSignAvail, benefAgeAvail, benefSexAvail, benefMessAvail, benefNamePres, benefAgePres, benefSexPres] = await Promise.all(
                [benefNamePromise, benefAgePromise, benefSexPromise, passGVRPromise,
                benefNameAvailPromise, nameSignAvailPromise, benefAgeAvailPromise, benefSexAvailPromise, benefMessAvailPromise,
                benefNamePresPromise, benefAgePresPromise,benefSexPresPromise]
            )

            // --- Cross-check the three documents agree on name / age / sex ---
            const nameConsistent = (benefName==benefNameAvail)&&(benefName==benefNamePres)&&(benefName==nameSignAvail)
            const ageConsistent = (benefAge==benefAgeAvail)&&(benefName==benefNamePres)
            const sexConsistent = (benefSex==benefSexAvail)&&(benefSex==benefSexPres)

            // --- Build the summary shown in the final alert ---
            let strOut =
            `${gatn}\n`+
            `Avail Pass: ${passGVR ? "TRUE": "REVIEW"}\n`+
            `${(Number(benefAge)<18) ? `MINOR BENEFICIARY Age: ${benefAge}\n` : ""}`+
            `${benefMessAvail ? `                           GAS: ${benefMessAvail}\n` : ""}` +
            `Name Consistent: ${nameConsistent ? "TRUE": "REVIEW"}\n`+
            `${nameConsistent ? "" : `  GVR: ${benefName}\n            AVL: ${benefNameAvail}\n            PRS: ${benefNamePres}\n    SignAvail: ${nameSignAvail}\n`}`+
            `Age Consistent: ${ageConsistent ? "TRUE": "REVIEW"}\n`+
            `${ageConsistent ? "" : `   GVR: ${benefAge}\n   AVL: ${benefAgeAvail}\n   PRS: ${benefAgePres}`}`+
            `Sex Consistent: ${sexConsistent ? "TRUE": "REVIEW"}\n`+
            `${sexConsistent ? "" : `   GVR: ${benefSex}\n   AVL: ${benefSexAvail}\n   PRS: ${benefSexPres}`}`
            console.log(strOut)
            alert(strOut)
        })
        row.appendChild(but)
    }
}


/* ============================================================================
 * SHARED DATA: anti-infective medicine list
 * Used by both the prescription page (Section 4) and the availment form
 * page (Section 5) to flag anti-infectious drugs.
 * ==========================================================================*/
const antiInfec = ["Albendazole","Azithromycin","Azithromycin","Azithromycin","Azithromycin","Azithromycin",
                   "Cefixime","Cefixime","Cefixime","Cefixime","Cefuroxime","Cefuroxime","Cefuroxime","Clindamycin","Clindamycin","Clindamycin","Clotrimazole","Clotrimazole","Clotrimazole","Cloxacillin","Cloxacillin",
                   "Doxycycline",
                   "Erythromycin","Erythromycin","Erythromycin","Erythromycin",
                   "Fluconazole","Fluconazole","Fluconazole",
                   "Ketoconazole","Ketoconazole","Ketoconazole","Ketoconazole","Ketoconazole",
                   "Mebendazole","Mebendazole","Mebendazole","Mebendazole","Mebendazole","Mebendazole","Mebendazole","Metronidazole","Metronidazole","Metronidazole",
                   "Oseltamivir",
                   "Tobramycin","Tobramycin","Tobramycin + Dexamethasone","Tobramycin + Dexamethasone"]

// Case-insensitive substring match against the anti-infective list above
function isAntiInfec(strMed){
    return antiInfec.find(function(antiInfecMed){return strMed.toLowerCase().includes(antiInfecMed.toLowerCase())})
}


/* ============================================================================
 * SECTION 4: /dashboard/claims/view/prescription
 * Enlarges the medicine detail text and tags anti-infectious drugs.
 * ==========================================================================*/
if(window.location.pathname.indexOf("/dashboard/claims/view/prescription")>=0 && extraFeatKo && extraFeatPres){
    const rowsMedic = document.querySelectorAll("#medicines > div.medicine-entry")
    for(let i = 0; i<rowsMedic.length; i++){
        const row = rowsMedic[i]

        // Bump up the font size of the medicine's second detail line
        const pSecond = row.querySelector("div.col-8 > p:nth-child(2)")
        if(pSecond){
            pSecond.setAttribute("style","font-size:1.4em")
        }

        // If this medicine is anti-infective, append a visible "ANTI-INFECTIOUS" tag
        const strMed = row.querySelector("div.col-8 > p:nth-child(1) > span").innerHTML
        const antiInfecFound = isAntiInfec(strMed)
        if(antiInfecFound){
            const div = row.querySelector("div.col-8")
            const p = document.createElement("p")
            p.innerText = "ANTI-INFECTIOUS"
            p.setAttribute("style","font-size:2em")
            div.appendChild(p)
        }
    }
}


/* ============================================================================
 * SHARED DATA: dispensing limits (in hours) per generic drug name.
 * Used only by Section 5 (availment form page) below.
 * ==========================================================================*/
const limitByHours = {
    "Albendazole":744,
    "Aluminum Hydroxide + Magnesium Hydroxide":168,
    "Atenolol":744,
    "Atorvastatin":744,
    "Azithromycin":744,
    "Budesonide + Formoterol":744,
    "Butamirate":168,
    "Captopril":744,
    "Cefixime":744,
    "Cefuroxime":744,
    "Celecoxib":168,
    "Cetirizine":168,
    "Clindamycin":744,
    "Clonidine":744,
    "Clopidogrel":744,
    "Clotrimazole":744,
    "Cloxacillin":744,
    "Colchicine":744,
    "Dapagliflozin":744,
    "Diltiazem":744,
    "Diphenhydramine":168,
    "Doxycycline":744,
    "Enalapril + Hydrochlorothiazide":744,
    "Erythromycin":744,
    "Fenofibrate":744,
    "Fluconazole":744,
    "Folic Acid + Iron Ferrous":744,
    "Gabapentin":744,
    "Ibuprofen":168,
    "Ipratropium":744,
    "Ipratropium + Salbutamol":120,
    "Iron (Ferrous Salt)":744,
    "Isosorbide Dinitrate":744,
    "Isosorbide Mononitrate":744,
    "Ketoconazole":744,
    "Loratadine":168,
    "Losartan + Hydrochlorothiazide":744,
    "Mebendazole":744,
    "Mefenamic Acid":168,
    "Methyldopa":744,
    "Metronidazole":744,
    "Montelukast":744,
    "Naproxen":168,
    "Omeprazole":336,
    "Oseltamivir":744,
    "Rosuvastatin":744,
    "Tamsulosin":744,
    "Telmisartan":744,
    "Telmisartan + Hydrochlorothiazide":744,
    "Tiotropium":744,
    "Tobramycin":744,
    "Tobramycin + Dexamethasone":744,
    "Valsartan":744,
    "Valsartan + Hydrochlorothiazide":744,
    "Vitex Negundo (Lagundi)":168,
    "Zinc":336,
    "Chlorphenamine":168,
    "Paracetamol":168,
    "Prednisone":336
}


/* ============================================================================
 * SECTION 5: /dashboard/claims/view/availment_form
 * Adds a "Dispensing Limit (days)" column, color-codes anti-infectious and
 * duplicate-medicine rows, and validates that unit price x quantity
 * matches the listed line price.
 * ==========================================================================*/
if(window.location.pathname.indexOf("/dashboard/claims/view/availment_form")>=0 && extraFeatKo && extraFeatAvail){
    const columnko = 4       // index where the new "limit" column gets inserted
    const days = true        // display the limit in days (true) instead of hours (false)

    // --- Insert the new header column ---
    const thko = document.createElement("th")
    thko.innerText = `Dispensing Limit (${days?"days":"hours"})`
    const table = document.querySelector("#table-container > table")
    const theadRow = table.querySelector("thead > tr")
    theadRow.insertBefore(thko, theadRow.children[columnko])

    const tBodyRows = table.querySelector("tbody").rows
    console.log(tBodyRows)

    const limitByHoursKeys = Object.keys(limitByHours)
    const medsSet = new Set()       // tracks medicines already seen, to detect duplicates
    const medsDuplSet = new Set()   // collects the names of duplicated medicines

    for(let i = 0; i<tBodyRows.length; i++){
        let color = "#FFFFFF"       // default row color; overridden below when flagged
        const row = tBodyRows[i]
        const tdFirst = row.querySelector("td:nth-child(1)")
        if(!tdFirst){
            continue
        }
        // Skip/merge non-data rows (e.g. section headers within the table)
        if(tdFirst.innerText === "" || Number.isNaN(Number(tdFirst.innerText))){
            tdFirst.setAttribute("colspan", 5)
            continue
        }

        const strMed = row.querySelector("td:nth-child(2)").innerText
        const strUnitPrice = row.querySelector("td:nth-child(3)").innerText
        const strQuant = row.querySelector("td:nth-child(4)").innerText
        const strPrice = row.querySelector("td:nth-child(5)").innerText

        // Look up this medicine's dispensing limit
        const medName = limitByHoursKeys.find((med)=>{return strMed.toLowerCase().includes(med.toLowerCase())})
        const limitHour = limitByHours[medName]
        const tdko = document.createElement("td")
        const antiInfecFound = isAntiInfec(strMed)
        // Anti-infectious drugs get a flat 14-day limit; otherwise convert hours -> days
        const numLimitDays = antiInfecFound ? 14: (limitHour/24)
        tdko.innerText = days ? numLimitDays : limitHour
        const numQuant = Number(strQuant)

        // --- Color coding ---
        if(antiInfecFound){
            color = "lightblue"
        }
        if(medsSet.has(strMed)){
            medsDuplSet.add(strMed)
            color = "#CBC3E3"    // duplicate medicine in the same claim
        }else{
            medsSet.add(strMed)
        }

        row.setAttribute("style",`background-color:${color}`)
        row.insertBefore(tdko, row.children[columnko])

        // --- Price sanity check: unit price x quantity should equal line price ---
        if(Number(strUnitPrice.replace("₱",""))*Number(strQuant)!==Number(strPrice.replace("₱",""))){
            console.log("Invalid Price")
            alert("Invalid Price")
        }
    }

    // --- Final summary of any duplicate medicines found in this claim ---
    if(medsDuplSet.size>0){
        const outStrDup = `Duplicate: ${[...medsDuplSet]}`
        console.log(`Duplicate: ${[...medsDuplSet]}`)
        alert(outStrDup)
    }
}