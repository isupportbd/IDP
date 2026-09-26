import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { authMiddleware } from "@/middlewares/auth-middleware.js";
import { requireRole } from "@/middlewares/role-middleware.js";
import {
  getTenants,
  getPendingSignups,
  approveSignup,
  rejectSignup,
  extendTenant,
  getTenantTransactions,
  toggleTenantStatus,
  deleteTenant,
  getPlans,
  createPlan,
  updatePlan,
  deletePlan,
  getPaymentSettings,
  savePaymentSettings,
  getStorageStats,
  getClientTypes,
  createClientType,
  updateClientType,
  toggleClientTypeStatus,
  deleteClientType,
  getLocations,
  createLocation,
  updateLocation,
  toggleLocationStatus,
  deleteLocation,
  getCommercialAreas,
  createCommercialArea,
  updateCommercialArea,
  toggleCommercialAreaStatus,
  deleteCommercialArea,
  getClientReferences,
  createClientReference,
  updateClientReference,
  toggleClientReferenceStatus,
  deleteClientReference,
  getColumnMappings,
  saveColumnMappings,
  getGlobalItems,
  createGlobalItem,
  updateGlobalItem,
  toggleGlobalItemStatus,
  deleteGlobalItem,
  getMeasurementUnits,
  createMeasurementUnit,
  updateMeasurementUnit,
  toggleMeasurementUnitStatus,
  deleteMeasurementUnit,
  getServiceUnits,
  createServiceUnit,
  updateServiceUnit,
  toggleServiceUnitStatus,
  deleteServiceUnit,
  getVatNotes,
  createVatNote,
  updateVatNote,
  toggleVatNoteStatus,
  deleteVatNote,
  getUnitConversions,
  createUnitConversion,
  updateUnitConversion,
  deleteUnitConversion,
  getPlatformPublicStats,
  getNotifications,
  getPendingRecharges,
  approveRecharge,
  rejectRecharge
} from "../controllers/superadmin.controller.js";
import {
  PlanSchema,
  ApproveSignupSchema,
  RejectSignupSchema,
  ExtendTenantSchema,
  PaymentSettingsSchema
} from "../controllers/superadmin.schema.js";

export const superAdminRouter = new Hono();

// Public / Shared endpoints
superAdminRouter.get("/public-stats", getPlatformPublicStats);
superAdminRouter.get("/plans", getPlans);
superAdminRouter.get("/payment-settings", getPaymentSettings);
superAdminRouter.get("/client-types", getClientTypes);
superAdminRouter.get("/locations", getLocations);
superAdminRouter.get("/commercial-areas", getCommercialAreas);
superAdminRouter.get("/references", getClientReferences);
superAdminRouter.get("/column-mappings", getColumnMappings);
superAdminRouter.get("/global-items", getGlobalItems);
superAdminRouter.get("/measurement-units", getMeasurementUnits);
superAdminRouter.get("/service-units", getServiceUnits);
superAdminRouter.get("/vat-notes", getVatNotes);

// Guard all subsequent SuperAdmin management endpoints
superAdminRouter.use("/notifications*", authMiddleware, requireRole("superadmin"));
superAdminRouter.use("/tenants*", authMiddleware, requireRole("superadmin"));
superAdminRouter.use("/pending-signups*", authMiddleware, requireRole("superadmin"));
superAdminRouter.use("/pending-recharges*", authMiddleware, requireRole("superadmin"));
superAdminRouter.use("/approve-signup*", authMiddleware, requireRole("superadmin"));
superAdminRouter.use("/reject-signup*", authMiddleware, requireRole("superadmin"));
superAdminRouter.use("/approve-recharge*", authMiddleware, requireRole("superadmin"));
superAdminRouter.use("/reject-recharge*", authMiddleware, requireRole("superadmin"));
superAdminRouter.use("/storage-stats*", authMiddleware, requireRole("superadmin"));

// Notifications (Protected)
superAdminRouter.get("/notifications", getNotifications);

// Tenants & Approvals (Protected)
superAdminRouter.get("/tenants", getTenants);
superAdminRouter.get("/pending-signups", getPendingSignups);
superAdminRouter.get("/pending-recharges", getPendingRecharges);
superAdminRouter.post("/approve-signup", zValidator("json", ApproveSignupSchema), approveSignup);
superAdminRouter.post("/reject-signup", zValidator("json", RejectSignupSchema), rejectSignup);
superAdminRouter.post("/approve-recharge", approveRecharge);
superAdminRouter.post("/reject-recharge", rejectRecharge);
superAdminRouter.post("/transactions/:id/approve", approveRecharge);
superAdminRouter.post("/transactions/:id/reject", rejectRecharge);
superAdminRouter.post("/tenants/:id/extend", zValidator("json", ExtendTenantSchema), extendTenant);
superAdminRouter.get("/tenants/:id/transactions", getTenantTransactions);
superAdminRouter.post("/tenants/:id/toggle-status", toggleTenantStatus);
superAdminRouter.delete("/tenants/:id", deleteTenant);

// Plans & Pricing Management (Protected)
superAdminRouter.post("/plans", authMiddleware, requireRole("superadmin"), zValidator("json", PlanSchema), createPlan);
superAdminRouter.put("/plans/:id", authMiddleware, requireRole("superadmin"), zValidator("json", PlanSchema), updatePlan);
superAdminRouter.delete("/plans/:id", authMiddleware, requireRole("superadmin"), deletePlan);

// Payment Gateway Settings Management (Protected)
superAdminRouter.post("/payment-settings", authMiddleware, requireRole("superadmin"), zValidator("json", PaymentSettingsSchema), savePaymentSettings);

// Client Types Management (Protected for write operations)
superAdminRouter.post("/client-types", authMiddleware, requireRole("superadmin"), createClientType);
superAdminRouter.put("/client-types/:id", authMiddleware, requireRole("superadmin"), updateClientType);
superAdminRouter.patch("/client-types/:id/toggle", authMiddleware, requireRole("superadmin"), toggleClientTypeStatus);
superAdminRouter.delete("/client-types/:id", authMiddleware, requireRole("superadmin"), deleteClientType);

// Locations & Commercial Areas Management (Protected for write operations)
superAdminRouter.post("/locations", authMiddleware, requireRole("superadmin"), createLocation);
superAdminRouter.put("/locations/:id", authMiddleware, requireRole("superadmin"), updateLocation);
superAdminRouter.patch("/locations/:id/toggle", authMiddleware, requireRole("superadmin"), toggleLocationStatus);
superAdminRouter.delete("/locations/:id", authMiddleware, requireRole("superadmin"), deleteLocation);

superAdminRouter.post("/commercial-areas", authMiddleware, requireRole("superadmin"), createCommercialArea);
superAdminRouter.put("/commercial-areas/:id", authMiddleware, requireRole("superadmin"), updateCommercialArea);
superAdminRouter.patch("/commercial-areas/:id/toggle", authMiddleware, requireRole("superadmin"), toggleCommercialAreaStatus);
superAdminRouter.delete("/commercial-areas/:id", authMiddleware, requireRole("superadmin"), deleteCommercialArea);

// Client References Management (Protected for write operations)
superAdminRouter.post("/references", authMiddleware, requireRole("superadmin"), createClientReference);
superAdminRouter.put("/references/:id", authMiddleware, requireRole("superadmin"), updateClientReference);
superAdminRouter.patch("/references/:id/toggle", authMiddleware, requireRole("superadmin"), toggleClientReferenceStatus);
superAdminRouter.delete("/references/:id", authMiddleware, requireRole("superadmin"), deleteClientReference);

// Column Mappings Management (Protected for write operations)
superAdminRouter.post("/column-mappings", authMiddleware, requireRole("superadmin"), saveColumnMappings);

// Global Master Items & HS Codes Management (Protected for write operations)
superAdminRouter.post("/global-items", authMiddleware, requireRole("superadmin"), createGlobalItem);
superAdminRouter.put("/global-items/:id", authMiddleware, requireRole("superadmin"), updateGlobalItem);
superAdminRouter.patch("/global-items/:id/toggle", authMiddleware, requireRole("superadmin"), toggleGlobalItemStatus);
superAdminRouter.delete("/global-items/:id", authMiddleware, requireRole("superadmin"), deleteGlobalItem);

// Measurement Units Management (Protected for write operations)
superAdminRouter.post("/measurement-units", authMiddleware, requireRole("superadmin"), createMeasurementUnit);
superAdminRouter.put("/measurement-units/:id", authMiddleware, requireRole("superadmin"), updateMeasurementUnit);
superAdminRouter.patch("/measurement-units/:id/toggle", authMiddleware, requireRole("superadmin"), toggleMeasurementUnitStatus);
superAdminRouter.delete("/measurement-units/:id", authMiddleware, requireRole("superadmin"), deleteMeasurementUnit);

// Global Service Units Management (Protected for write operations)
superAdminRouter.post("/service-units", authMiddleware, requireRole("superadmin"), createServiceUnit);
superAdminRouter.put("/service-units/:id", authMiddleware, requireRole("superadmin"), updateServiceUnit);
superAdminRouter.patch("/service-units/:id/toggle", authMiddleware, requireRole("superadmin"), toggleServiceUnitStatus);
superAdminRouter.delete("/service-units/:id", authMiddleware, requireRole("superadmin"), deleteServiceUnit);

// VAT Notes Management (Protected for write operations)
superAdminRouter.post("/vat-notes", authMiddleware, requireRole("superadmin"), createVatNote);
superAdminRouter.put("/vat-notes/:id", authMiddleware, requireRole("superadmin"), updateVatNote);
superAdminRouter.patch("/vat-notes/:id/toggle", authMiddleware, requireRole("superadmin"), toggleVatNoteStatus);
superAdminRouter.delete("/vat-notes/:id", authMiddleware, requireRole("superadmin"), deleteVatNote);

// Unit Conversions Management (Protected for write operations)
superAdminRouter.get("/unit-conversions", getUnitConversions);
superAdminRouter.post("/unit-conversions", authMiddleware, requireRole("superadmin"), createUnitConversion);
superAdminRouter.put("/unit-conversions/:id", authMiddleware, requireRole("superadmin"), updateUnitConversion);
superAdminRouter.delete("/unit-conversions/:id", authMiddleware, requireRole("superadmin"), deleteUnitConversion);

// Storage Stats (Protected)
superAdminRouter.get("/storage-stats", getStorageStats);

export default superAdminRouter;
