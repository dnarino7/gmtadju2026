// ==UserScript==
// @name         gamot share
// @namespace    lvmao
// @version      2026-09-30
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

// ============================================================
// CONFIG
// These values control behavior across every page the script runs on.
// ============================================================

// Printed as "Adjudicated by: <name>" on the print page
const name = "Aldrin M. Delena"
// Font size (px) for that adjudicator stamp
const fontSize = 20

// Master switches for the three feature sets below
const extraFeatKo    = true  // keyboard shortcuts + "open all" cross-check button
const extraFeatAvail = true  // dispensing-limit + duplicate + price columns (availment_form)
const extraFeatPres  = true  // anti-infectious labeling (prescription page)


// ============================================================
// HELPER: checkAllPassGatn
// Scans a validation report and returns true only if every
// result row after the header says "PASS".
// Parameter is named "doc" to avoid shadowing the global document.
// ============================================================

function checkAllPassGatn(doc) {
    const sec = doc.querySelector("#validation-report-view > section:nth-child(9)")
    const rowsSec = sec.querySelectorAll("div.row")
    for (let i = 1; i < rowsSec.length; i++) {
        const result = rowsSec[i].querySelector("div:last-child > p").innerText
        if (result !== "PASS") return false
    }
    return true
}


// ============================================================
// SHARED DATA: anti-infective medicine list
// Used by Section 4 (prescription) and Section 5 (availment form).
// Duplicates removed — find() only needs one match.
// ============================================================

const antiInfec = [
    "Albendazole",
    "Azithromycin",
    "Cefixime",
    "Cefuroxime",
    "Clindamycin",
    "Clotrimazole",
    "Cloxacillin",
    "Doxycycline",
    "Erythromycin",
    "Fluconazole",
    "Ketoconazole",
    "Mebendazole",
    "Metronidazole",
    "Oseltamivir",
    "Tobramycin + Dexamethasone",
    "Tobramycin"
]

// Case-insensitive substring match against the anti-infective list
function isAntiInfec(strMed) {
    return antiInfec.find(function (med) {
        return strMed.toLowerCase().includes(med.toLowerCase())
    })
}


// ============================================================
// SECTION 1: /dashboard/claims/print/*
// Renames the browser tab to the claim number, injects the
// "Adjudicated by: NAME" stamp at the bottom of the printout,
// then fires the print dialog automatically.
// ============================================================

if (window.location.pathname.indexOf("/dashboard/claims/print") >= 0) {

    // Use the GACN from the breadcrumb as the document title so the
    // saved PDF filename matches the claim number
    const gacn = document.querySelector("#breadcrumb_header > li:nth-child(2)").innerText
    document.title = gacn

    const appendDiv = document.createElement("div")
    appendDiv.setAttribute("style", "display:flex; align-items:left; justify-content:center; flex-direction:column !important;")
    const appendP = document.createElement("p")
    appendP.setAttribute("style", "font-size:" + fontSize + "px")
    appendP.appendChild(document.createTextNode("Adjudicated by: " + name))
    const appendSpan = document.createElement("span")
    appendSpan.appendChild(appendP)
    appendDiv.appendChild(appendSpan)
    const last = document.querySelector("#printArea > div.content > div:last-child")
    last.after(appendDiv)

    window.print()
}


// ============================================================
// SECTION 2: /dashboard/validation/view/*
// Renames the tab to the GATN and adds two keyboard shortcuts:
//   backtick = run all-PASS check and alert result
//   1        = copy "GATN <tab> beneficiary name" to clipboard
// ============================================================

if (window.location.pathname.indexOf("/dashboard/validation/view") >= 0) {
    const gatn = document.querySelector("body > div.base-layout > div:nth-child(3) > div > div:nth-child(1) > h4").innerText
    document.title = gatn

    if (extraFeatKo) {
        window.addEventListener("keyup", function (e) {

            if (e.key === "`") {
                alert(checkAllPassGatn(document) ? "Pass" : "REVIEW REVIEW REVIEW")
            }

            if (e.key === "1") {
                const nameBenef = document.querySelector("#validation-report-view > section:nth-child(3) > div:nth-child(1) > p").innerText
                const gatnNow   = document.querySelector("body > div.base-layout > div:nth-child(3) > div > div:nth-child(1) > h4").innerText
                // Hidden textarea trick to write to clipboard (no navigator.clipboard needed)
                const tempArea = document.createElement("textarea")
                document.body.appendChild(tempArea)
                tempArea.innerText = gatnNow + "\t" + nameBenef
                tempArea.select()
                document.execCommand("copy")
                document.body.removeChild(tempArea)
                alert("Copied")
            }

        }, true)
    }
}


// ============================================================
// SECTION 3: /dashboard/claims/view/*  (list page only)
// Excludes /prescription and /availment_form sub-pages.
//
// Adds:
//   - Backtick shortcut to click the built-in print button
//   - "All Docs" column with one button per claim row that:
//       * tracks how many times it has been clicked, shown as
//         "GATN (N)" on the button face, persisted in localStorage
//         (no network involved, no additional grants needed)
//       * opens all attachments + GVR + Availment + Prescription
//         in new tabs
//       * scrapes name / age / sex / PIN / USPC from each tab
//       * cross-checks consistency across all three documents
//       * shows a single unified summary alert with all results
// ============================================================

if (
    window.location.pathname.indexOf("/dashboard/claims/view") >= 0 &&
    extraFeatKo &&
    window.location.pathname.indexOf("/dashboard/claims/view/prescription") < 0 &&
    window.location.pathname.indexOf("/dashboard/claims/view/availment_form") < 0
) {

    // Backtick shortcut: click the page's built-in print button
    window.addEventListener("keydown", async function (e) {
        if (e.key === "`") {
            document.querySelector("#printButton").click()
        }
    }, true)

    // Add "All Docs" column header to the claims table
    const gatnTable = document.querySelector(
        "#page-content-wrapper > div > div.container-fluid > div.card.mb-3 > div.card-body.p-0.table-responsive.table-responsive-sm.custom-table-wrapper > table"
    )
    const thBut = document.createElement("th")
    thBut.setAttribute("scope", "col")
    thBut.innerText = "All Docs"
    gatnTable.querySelector("thead > tr").appendChild(thBut)

    // Build one "open all + cross-check" button per row
    const rows = gatnTable.querySelector("tbody").rows
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i]

        const gatn      = row.querySelector("td:nth-child(1) > a").innerText
        const linkGVR   = row.querySelector("td:nth-child(1) > a").getAttribute("href")
        const linkAvail = row.querySelector("td:nth-child(10) > a").getAttribute("href")
        const linkPres  = row.querySelector("td:nth-child(11) > a").getAttribute("href")
        const tdAtt     = row.querySelector("td:nth-child(12) > div")
        const linkAttArr = tdAtt ? row.querySelectorAll("td:nth-child(12) > div > a") : null

        // Feature 1: click counter — persisted in localStorage per GATN, no grants needed
        const clickKey = "gamot_clicks_" + gatn
        let clickCount = Number(localStorage.getItem(clickKey) || 0)

        const but = document.createElement("button")
        but.setAttribute("class", "no-loader")
        but.innerText = gatn + " (" + clickCount + ")"

        but.addEventListener("click", async () => {

            // Increment and persist the click count, then update button label
            clickCount++
            localStorage.setItem(clickKey, clickCount)
            but.innerText = gatn + " (" + clickCount + ")"

            // Open all attachments in separate tabs
            if (linkAttArr) {
                for (let j = 0; j < linkAttArr.length; j++) {
                    window.open(linkAttArr[j].getAttribute("href"))
                }
            }

            // Open the three main document tabs
            const winGVR   = window.open(linkGVR)
            const winAvail = window.open(linkAvail)
            const winPres  = window.open(linkPres)

            // Waits for a newly-opened window to finish loading, then returns
            // the trimmed innerText of one element (or null if the element is missing)
            function queryText(win, query) {
                return new Promise(function (resolve) {
                    win.addEventListener("load", function () {
                        const el = win.document.querySelector(query)
                        resolve(el ? el.innerText.trim() : null)
                    })
                })
            }

            // GVR (validation report) scrapes
            const pBenefName  = queryText(winGVR, "#validation-report-view > section:nth-child(3) > div:nth-child(1) > p")
            const pBenefAge   = queryText(winGVR, "#validation-report-view > section:nth-child(3) > div:nth-child(4) > div:nth-child(2) > div:nth-child(1) > p")
            const pBenefSex   = queryText(winGVR, "#validation-report-view > section:nth-child(3) > div:nth-child(4) > div:nth-child(2) > div:nth-child(2) > p")
            // Feature 2 [needs user bugfixing]: replace selectors with the real PIN and USPC fields on the GVR tab
            const pPINgvr     = queryText(winGVR, "SELECTOR_PIN_GVR")
            const pUSPCgvr    = queryText(winGVR, "SELECTOR_USPC_GVR")
            const pPassGVR    = new Promise(function (resolve) {
                winGVR.addEventListener("load", function () {
                    resolve(checkAllPassGatn(winGVR.document))
                })
            })

            // Availment Form scrapes
            const pNameAvail  = queryText(winAvail, "#availmentForm > div:nth-child(9) > div:nth-child(1) > div:nth-child(3) > span")
            const pSignAvail  = queryText(winAvail, "#availmentNameDisplay")
            const pAgeAvail   = queryText(winAvail, "#availmentForm > div:nth-child(9) > div:nth-child(2) > div:nth-child(3) > span:nth-child(2)")
            const pSexAvail   = queryText(winAvail, "#availmentForm > div:nth-child(9) > div:nth-child(2) > div:nth-child(3) > span:nth-child(4)")
            const pMessAvail  = queryText(winAvail, "#uploadedIdMessage")
            // Feature 2 [needs user bugfixing]: replace selectors with the real PIN and USPC fields on the Availment Form tab
            const pPINavail   = queryText(winAvail, "SELECTOR_PIN_AVAIL")
            const pUSPCavail  = queryText(winAvail, "SELECTOR_USPC_AVAIL")

            // Prescription scrapes
            const pNamePres   = queryText(winPres, "#basic-details > div.row.no-border.mt-2 > div > div > span")
            const pAgePres    = queryText(winPres, "#basic-details > div.row.no-border.justify-content-end > div:nth-child(1) > div > span")
            const pSexPres    = queryText(winPres, "#basic-details > div.row.no-border.justify-content-end > div:nth-child(2) > div > span")
            // Feature 2 [needs user bugfixing]: replace selectors with the real PIN and USPC fields on the Prescription tab
            const pPINpres    = queryText(winPres, "SELECTOR_PIN_PRES")
            const pUSPCpres   = queryText(winPres, "SELECTOR_USPC_PRES")

            // Wait for all scrapes to resolve before comparing
            const [
                benefName, benefAge, benefSex, pinGVR, uspcGVR, passGVR,
                nameAvail, signAvail, ageAvail, sexAvail, messAvail, pinAvail, uspcAvail,
                namePres, agePres, sexPres, pinPres, uspcPres
            ] = await Promise.all([
                pBenefName, pBenefAge, pBenefSex, pPINgvr, pUSPCgvr, pPassGVR,
                pNameAvail, pSignAvail, pAgeAvail, pSexAvail, pMessAvail, pPINavail, pUSPCavail,
                pNamePres, pAgePres, pSexPres, pPINpres, pUSPCpres
            ])

            // Consistency checks across the three documents
            const nameConsistent = (benefName === nameAvail) && (benefName === namePres) && (benefName === signAvail)
            // Bug fix: was previously comparing benefName===namePres instead of benefAge===agePres
            const ageConsistent  = (benefAge === ageAvail) && (benefAge === agePres)
            const sexConsistent  = (benefSex === sexAvail) && (benefSex === sexPres)
            // Feature 2 [needs user bugfixing]: these will show REVIEW until real selectors are provided
            const pinConsistent  = (pinGVR !== null) && (pinGVR === pinAvail) && (pinGVR === pinPres)
            const uspcConsistent = (uspcGVR !== null) && (uspcGVR === uspcAvail) && (uspcGVR === uspcPres)

            // Feature 4: senior citizen flag (60 and above per Philippine law)
            const ageNum   = parseInt(benefAge, 10)
            const isMinor  = !isNaN(ageNum) && ageNum < 18
            const isSenior = !isNaN(ageNum) && ageNum >= 60

            // Build the unified summary alert
            let strOut =
                gatn + "\n" +
                "Avail Pass: " + (passGVR ? "TRUE" : "REVIEW") + "\n" +
                (isMinor  ? "MINOR BENEFICIARY Age: " + benefAge + "\n" : "") +
                (isSenior ? "SENIOR CITIZEN Age: "    + benefAge + "\n" : "") +
                (messAvail ? "GAS: " + messAvail + "\n" : "") +
                "Name Consistent: " + (nameConsistent ? "TRUE" : "REVIEW") + "\n" +
                (nameConsistent ? "" :
                    "  GVR: "  + benefName + "\n" +
                    "  AVL: "  + nameAvail + "\n" +
                    "  PRS: "  + namePres  + "\n" +
                    "  Sign: " + signAvail + "\n") +
                "Age Consistent: " + (ageConsistent ? "TRUE" : "REVIEW") + "\n" +
                (ageConsistent ? "" :
                    "  GVR: " + benefAge + "\n" +
                    "  AVL: " + ageAvail + "\n" +
                    "  PRS: " + agePres  + "\n") +
                "Sex Consistent: " + (sexConsistent ? "TRUE" : "REVIEW") + "\n" +
                (sexConsistent ? "" :
                    "  GVR: " + benefSex + "\n" +
                    "  AVL: " + sexAvail + "\n" +
                    "  PRS: " + sexPres  + "\n") +
                // Feature 2 [needs user bugfixing]: will show REVIEW until selectors are filled in
                "PIN Consistent: " + (pinConsistent ? "TRUE" : "REVIEW") + " [needs user bugfixing]\n" +
                (pinConsistent ? "" :
                    "  GVR: " + pinGVR   + "\n" +
                    "  AVL: " + pinAvail + "\n" +
                    "  PRS: " + pinPres  + "\n") +
                "USPC Consistent: " + (uspcConsistent ? "TRUE" : "REVIEW") + " [needs user bugfixing]\n" +
                (uspcConsistent ? "" :
                    "  GVR: " + uspcGVR   + "\n" +
                    "  AVL: " + uspcAvail + "\n" +
                    "  PRS: " + uspcPres  + "\n")

            console.log(strOut)
            alert(strOut)
        })

        // Wrap the button in a <td> — buttons must not be direct children of <tr>
        const td = document.createElement("td")
        td.appendChild(but)
        row.appendChild(td)
    }
}


// ============================================================
// SECTION 4: /dashboard/claims/view/prescription
// Enlarges the medicine detail line and tags anti-infectious drugs.
// ============================================================

if (
    window.location.pathname.indexOf("/dashboard/claims/view/prescription") >= 0 &&
    extraFeatKo &&
    extraFeatPres
) {
    const rowsMedic = document.querySelectorAll("#medicines > div.medicine-entry")
    for (let i = 0; i < rowsMedic.length; i++) {
        const row = rowsMedic[i]

        // Enlarge the second detail line (dosage / instructions)
        const pSecond = row.querySelector("div.col-8 > p:nth-child(2)")
        if (pSecond) pSecond.setAttribute("style", "font-size:1.4em")

        // Append a large ANTI-INFECTIOUS label if the drug matches
        const strMed = row.querySelector("div.col-8 > p:nth-child(1) > span").innerHTML
        if (isAntiInfec(strMed)) {
            const div = row.querySelector("div.col-8")
            const p   = document.createElement("p")
            p.innerText = "ANTI-INFECTIOUS"
            p.setAttribute("style", "font-size:2em")
            div.appendChild(p)
        }
    }
}


// ============================================================
// SHARED DATA: dispensing limits in hours per generic drug name.
// Used only by Section 5 (availment form page).
// ============================================================

const limitByHours = {
    "Albendazole": 744,
    "Aluminum Hydroxide + Magnesium Hydroxide": 168,
    "Atenolol": 744,
    "Atorvastatin": 744,
    "Azithromycin": 744,
    "Budesonide + Formoterol": 744,
    "Butamirate": 168,
    "Captopril": 744,
    "Cefixime": 744,
    "Cefuroxime": 744,
    "Celecoxib": 168,
    "Cetirizine": 168,
    "Clindamycin": 744,
    "Clonidine": 744,
    "Clopidogrel": 744,
    "Clotrimazole": 744,
    "Cloxacillin": 744,
    "Colchicine": 744,
    "Dapagliflozin": 744,
    "Diltiazem": 744,
    "Diphenhydramine": 168,
    "Doxycycline": 744,
    "Enalapril + Hydrochlorothiazide": 744,
    "Erythromycin": 744,
    "Fenofibrate": 744,
    "Fluconazole": 744,
    "Folic Acid + Iron Ferrous": 744,
    "Gabapentin": 744,
    "Ibuprofen": 168,
    "Ipratropium": 744,
    "Ipratropium + Salbutamol": 120,
    "Iron (Ferrous Salt)": 744,
    "Isosorbide Dinitrate": 744,
    "Isosorbide Mononitrate": 744,
    "Ketoconazole": 744,
    "Loratadine": 168,
    "Losartan + Hydrochlorothiazide": 744,
    "Mebendazole": 744,
    "Mefenamic Acid": 168,
    "Methyldopa": 744,
    "Metronidazole": 744,
    "Montelukast": 744,
    "Naproxen": 168,
    "Omeprazole": 336,
    "Oseltamivir": 744,
    "Rosuvastatin": 744,
    "Tamsulosin": 744,
    "Telmisartan": 744,
    "Telmisartan + Hydrochlorothiazide": 744,
    "Tiotropium": 744,
    "Tobramycin": 744,
    "Tobramycin + Dexamethasone": 744,
    "Valsartan": 744,
    "Valsartan + Hydrochlorothiazide": 744,
    "Vitex Negundo (Lagundi)": 168,
    "Zinc": 336,
    "Chlorphenamine": 168,
    "Paracetamol": 168,
    "Prednisone": 336
}


// ============================================================
// SECTION 5: /dashboard/claims/view/availment_form
// Adds:
//   - "Dispensing Limit (days)" column after Quantity
//   - "Price OK?" column at the end (Feature 3)
//   - Row colors: lightblue = anti-infective, purple = duplicate
//   - Duplicate medicine summary alert after the table is built
// ============================================================

if (
    window.location.pathname.indexOf("/dashboard/claims/view/availment_form") >= 0 &&
    extraFeatKo &&
    extraFeatAvail
) {
    const columnko = 4   // children[] index to insert the dispensing-limit column before
    const days = true    // true = show limit in days, false = show in hours

    const table    = document.querySelector("#table-container > table")
    const theadRow = table.querySelector("thead > tr")

    // Insert "Dispensing Limit" header before the Price column
    const thLimit = document.createElement("th")
    thLimit.innerText = "Dispensing Limit (" + (days ? "days" : "hours") + ")"
    theadRow.insertBefore(thLimit, theadRow.children[columnko])

    // Feature 3: append "Price OK?" header at the far right
    const thPriceOk = document.createElement("th")
    thPriceOk.innerText = "Price OK?"
    theadRow.appendChild(thPriceOk)

    const tBodyRows  = table.querySelector("tbody").rows
    const limitKeys  = Object.keys(limitByHours)
    const medsSet    = new Set()  // medicines already seen in this claim (duplicate detection)
    const medsDuplSet = new Set() // names of medicines that appeared more than once

    for (let i = 0; i < tBodyRows.length; i++) {
        let color = "#FFFFFF"
        const row     = tBodyRows[i]
        const tdFirst = row.querySelector("td:nth-child(1)")
        if (!tdFirst) continue

        // Skip section-header rows (empty first cell or non-numeric row number)
        if (tdFirst.innerText === "" || Number.isNaN(Number(tdFirst.innerText))) {
            tdFirst.setAttribute("colspan", 5)
            continue
        }

        const strMed       = row.querySelector("td:nth-child(2)").innerText
        const strUnitPrice = row.querySelector("td:nth-child(3)").innerText
        const strQuant     = row.querySelector("td:nth-child(4)").innerText
        const strPrice     = row.querySelector("td:nth-child(5)").innerText

        // Dispensing limit cell
        const medName        = limitKeys.find(function (med) { return strMed.toLowerCase().includes(med.toLowerCase()) })
        const limitHour      = limitByHours[medName]
        const antiInfecFound = isAntiInfec(strMed)
        // Anti-infectious drugs get a flat 14-day limit; all others convert from hours
        const numLimitDays   = antiInfecFound ? 14 : (limitHour / 24)

        const tdLimit = document.createElement("td")
        tdLimit.innerText = days ? numLimitDays : limitHour

        // Color coding
        if (antiInfecFound) color = "lightblue"
        if (medsSet.has(strMed)) {
            medsDuplSet.add(strMed)
            color = "#CBC3E3"  // purple = duplicate
        } else {
            medsSet.add(strMed)
        }

        row.setAttribute("style", "background-color:" + color)
        row.insertBefore(tdLimit, row.children[columnko])

        // Feature 3: Price OK? cell
        // Strip everything that is not a digit or decimal point before converting.
        // This handles the peso sign and thousands commas (e.g. "1,234.56").
        const unitPrice = Number(strUnitPrice.replace(/[^\d.]/g, ""))
        const linePrice = Number(strPrice.replace(/[^\d.]/g, ""))
        const calcPrice = unitPrice * Number(strQuant)
        // Allow up to 1 centavo of floating-point rounding error
        const priceOk   = Math.abs(calcPrice - linePrice) < 0.01

        const tdPriceOk = document.createElement("td")
        tdPriceOk.innerText = priceOk ? "OK" : "INVALID"
        if (priceOk) {
            tdPriceOk.setAttribute("style", "color:green; font-weight:bold")
        } else {
            tdPriceOk.setAttribute("style", "color:red; font-weight:bold; background-color:#FFCCCC")
        }
        row.appendChild(tdPriceOk)
    }

    // Show a summary if any medicines appeared more than once in this claim
    if (medsDuplSet.size > 0) {
        const dupMsg = "Duplicate: " + [...medsDuplSet].join(", ")
        console.log(dupMsg)
        alert(dupMsg)
    }
}
