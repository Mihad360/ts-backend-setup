import config from "../config";
import { AboutModel } from "../modules/Settings/About/About.model";
import { PrivacyModel } from "../modules/Settings/privacy/Privacy.model";
import { TermsModel } from "../modules/Settings/Terms/Terms.model";
import { UserModel } from "../modules/User/user.model";

const dummyPrivacy = {
  description: "Default Privacy Policy. Update via Admin Settings.",
};
const dummyAbout = {
  description: "Default About Us. Update via Admin Settings.",
};
const dummyTerms = {
  description: "Default Terms and Conditions. Update via Admin Settings.",
};

const admin = {
  email: config.ADMIN_EMAIL as string,
  password: config.ADMIN_PASS as string,
  role: "admin" as const,
  isVerified: true,
};

const superAdmin = {
  email: config.SUPER_ADMIN_EMAIL as string,
  password: config.SUPER_ADMIN_PASS as string,
  role: "super_admin" as const,
  isVerified: true,
};

export const seedAdmin = async () => {
  try {
    if (!admin.email || !admin.password) return;

    const isAdminExist = await UserModel.findOne({ email: admin.email });
    if (!isAdminExist) {
      await UserModel.create(admin);
      // eslint-disable-next-line no-console
      console.log("Admin created successfully.");
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error seeding Admin:", error);
  }
};

export const seedSuperAdmin = async () => {
  try {
    if (!superAdmin.email || !superAdmin.password) return;

    const isSuperAdminExist = await UserModel.findOne({
      email: superAdmin.email,
    });
    if (!isSuperAdminExist) {
      await UserModel.create(superAdmin);
      // eslint-disable-next-line no-console
      console.log("Super admin created successfully.");
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error seeding super admin:", error);
  }
};

export const seedPrivacy = async () => {
  try {
    const privacy = await PrivacyModel.findOne();
    if (!privacy) {
      await PrivacyModel.create(dummyPrivacy);
      // eslint-disable-next-line no-console
      console.log("Privacy policy seeded successfully.");
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error seeding privacy policy:", error);
  }
};

export const seedTerms = async () => {
  try {
    const terms = await TermsModel.findOne();
    if (!terms) {
      await TermsModel.create(dummyTerms);
      // eslint-disable-next-line no-console
      console.log("Terms and conditions seeded successfully.");
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error seeding terms and conditions:", error);
  }
};

export const seedAbout = async () => {
  try {
    const about = await AboutModel.findOne();
    if (!about) {
      await AboutModel.create(dummyAbout);
      // eslint-disable-next-line no-console
      console.log("About us seeded successfully.");
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error seeding about us:", error);
  }
};
