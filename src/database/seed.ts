import { initDatabase } from "../framework/database/connection.js";
import { db } from "../framework/facade.js";
import { customerTypes } from "../modules/services/database/models/customer_types.js";
import { clientReferences } from "../modules/services/database/models/references.js";
import { companySettings } from "../modules/firm/database/models/company_settings.js";
import { bankAccounts } from "../modules/firm/database/models/bank_accounts.js";
import { expenseHeads } from "../modules/firm/database/models/expense_heads.js";
import { clients } from "../modules/clients/database/models/clients.js";
import { clientManagers } from "../modules/clients/database/models/client_managers.js";
import { users } from "../modules/auth/database/models/user.js";

async function runSeed() {
  await initDatabase();
  console.log("Seeding Master Database Records in PostgreSQL...");

  // 1. Customer Types
  const defaultTypes = [
    { typeName: "Importer", description: "Standard import client" },
    { typeName: "Commercial Importer", description: "Commercial import business" },
    { typeName: "Manufacturer", description: "Manufacturing & production entity" },
    { typeName: "Trader", description: "General trading & distribution" },
    { typeName: "Exporter", description: "Export-oriented firm" },
    { typeName: "Service Provider", description: "Service and consultancy provider" }
  ];

  for (const item of defaultTypes) {
    await db.insert(customerTypes).values({
      typeName: item.typeName,
      description: item.description,
      isActive: true
    }).onConflictDoNothing({ target: customerTypes.typeName });
  }

  // 2. Client References
  const defaultRefs = [
    { name: "Md. Aminul Islam (Tax Consultant)", phone: "01711998877", email: "aminul.tax@gmail.com", notes: "Senior VAT & Income Tax Consultant" },
    { name: "Rahman & Associates", phone: "01819887766", email: "info@rahmanassociates.bd", notes: "Chartered Accountants & Auditors" },
    { name: "Kazi Faruk (C&F Agent)", phone: "01911776655", email: "kazi.faruk@cnfbd.com", notes: "Chittagong Port Customs C&F Agent" },
    { name: "Direct Client Acquisition", phone: "01819234567", email: "billing@associatesvat.com", notes: "Direct firm walk-in client" }
  ];

  for (const refItem of defaultRefs) {
    await db.insert(clientReferences).values({
      name: refItem.name,
      phone: refItem.phone,
      email: refItem.email,
      notes: refItem.notes,
      isActive: true
    }).onConflictDoNothing({ target: clientReferences.name });
  }

  // 3. Company Settings
  const existingCompany = (await db.select().from(companySettings).limit(1))[0];
  if (!existingCompany) {
    await db.insert(companySettings).values({
      companyName: "ASSOCIATES & CO. VAT & TAX CONSULTANCY",
      proprietorName: "Advocate Md. Ruhul Amin",
      phone: "+880 1819-234567",
      email: "billing@associatesvat.com",
      website: "https://associatesvat.com",
      address: "Suite # 504, City Heart Building, 67 Naya Paltan, VIP Road, Dhaka-1000",
      binNumber: "001234567-0101",
      tinNumber: "782910384721",
      tradeLicenseNo: "TRAD/DSCC/038291",
      invoicePrefix: "INV",
      invoiceTerms: "1. Payment is due within 15 days of invoice date.\n2. Please mention the invoice number as reference in payment.\n3. Checks/Transfers are subject to realization.",
      receiptPrefix: "MR",
      autoDueCarryForward: true,
      binUniqueEnforcement: true,
      allowDuplicateMobile: true
    });
  }

  // 4. Bank Account
  const existingBank = (await db.select().from(bankAccounts).limit(1))[0];
  if (!existingBank) {
    await db.insert(bankAccounts).values({
      bankName: "Dutch-Bangla Bank PLC",
      accountName: "Associates & Co. Consulting",
      accountNumber: "115.120.987654",
      branchName: "Naya Paltan Branch, Dhaka",
      routingNumber: "090271829",
      bkashNumber: "01819234567",
      nagadNumber: "01711234567",
      isDefault: true,
      isActive: true
    });
  }

  // 5. Expense Heads
  const defaultExpenses = [
    { name: "Office Rent & Service Charges", code: "EXP-01", category: "Operational", description: "Monthly office space rental and building service charge" },
    { name: "Staff Salaries & Allowances", code: "EXP-02", category: "Administrative", description: "Monthly payroll and consultant retainers" },
    { name: "Utilities (Electricity, Water, Gas)", code: "EXP-03", category: "Operational", description: "Office utility and electricity bills" },
    { name: "Internet & IT Infrastructure", code: "EXP-04", category: "Operational", description: "Broadband fiber internet, cloud hosting, and domain fees" },
    { name: "Stationary, Printing & Postage", code: "EXP-05", category: "Administrative", description: "Tax filing binders, paper, cartridge, courier expenses" },
    { name: "Statutory Fees & NBR Challans", code: "EXP-06", category: "Statutory & Fees", description: "Government revenue stamps, tribunal fees, registration charges" },
    { name: "Client Refreshment & Entertainment", code: "EXP-07", category: "Miscellaneous", description: "Official guest entertainment and meeting refreshments" }
  ];

  for (const exp of defaultExpenses as any[]) {
    await db.insert(expenseHeads).values({
      name: exp.name,
      code: exp.code,
      category: exp.category,
      description: exp.description,
      isActive: true
    }).onConflictDoNothing({ target: expenseHeads.name });
  }

  // 6. Seed Initial Clients
  const existingClient = (await db.select().from(clients).limit(1))[0];
  if (!existingClient) {
    const types = await db.select().from(customerTypes);
    const refs = await db.select().from(clientReferences);

    const importerType = types.find(t => t.typeName === "Importer") || types[0];
    const commType = types.find(t => t.typeName === "Commercial Importer") || types[0];
    const mfgType = types.find(t => t.typeName === "Manufacturer") || types[0];

    const ref1 = refs[0];
    const ref2 = refs[1] || refs[0];
    const ref3 = refs[2] || refs[0];

    const sampleClients = [
      {
        companyName: "Al-Madina Steel & Re-Rolling Mills Ltd.",
        proprietorName: "Engr. Md. Farhad Hossain",
        mobile: "01711223344",
        alternativeMobile: "01819556677",
        email: "accounts@almadinasteel.com",
        address: "Plot # 45, BIDC Road, Tongi Industrial Area, Gazipur",
        binNumber: "000123456-0101",
        tinNumber: "456789012345",
        tradeLicenseNo: "TRAD/TNG/2024/0912",
        customerTypeId: mfgType?.id,
        referenceId: ref1?.id,
        vatUserId: "almadina_vat",
        vatPassword: "VatPass@Steel2026",
        vatServiceType: "FULL",
        isActive: true,
        notes: "Heavy manufacturer client. Requires monthly 9.1 sub-total verification."
      },
      {
        companyName: "Apex Global Trade & Commodities",
        proprietorName: "Kazi Ashiqur Rahman",
        mobile: "01819334455",
        alternativeMobile: "01712445566",
        email: "contact@apexgtrade.com.bd",
        address: "Khatunganj Commercial Hub, Kotwali, Chattogram",
        binNumber: "000987654-0202",
        tinNumber: "789012345678",
        tradeLicenseNo: "TRAD/CCC/2023/1842",
        customerTypeId: commType?.id,
        referenceId: ref2?.id,
        vatUserId: "apex_ctg_vat",
        vatPassword: "ApexCtg#Vat99",
        vatServiceType: "FULL",
        isActive: true,
        notes: "Imports bulk consumer goods via Chittagong Port."
      },
      {
        companyName: "Green Textile Dyeing & Finishing Mills",
        proprietorName: "Haji Nurul Islam",
        mobile: "01912556677",
        alternativeMobile: "01611889900",
        email: "info@greentextilebd.com",
        address: "Fatullah BSCIC Industrial Estate, Narayanganj",
        binNumber: "000554433-0303",
        tinNumber: "321098765432",
        tradeLicenseNo: "TRAD/NCC/2024/0056",
        customerTypeId: importerType?.id,
        referenceId: ref3?.id,
        vatUserId: "greentex_vat",
        vatPassword: "GreenTextile@2026",
        vatServiceType: "ONLY_RETURN",
        isActive: true,
        notes: "Export-oriented yarn & dye importer."
      }
    ];

    const insertedClients = await db.insert(clients).values(sampleClients as any[]).returning();

    // Assign to first user if available
    const firstUser = (await db.select().from(users).limit(1))[0];
    if (firstUser && insertedClients.length > 0) {
      await db.insert(clientManagers).values([
        { clientId: insertedClients[0].id, managerId: firstUser.id },
        { clientId: insertedClients[1].id, managerId: firstUser.id }
      ]);
    }
  }

  console.log("Database seeded successfully with Real Firm, Reference & Client Records!");
  process.exit(0);
}

runSeed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
