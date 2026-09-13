import * as providerService from "../services/provider.service.js";

export const listPublic = async (request, response) => {
  const result = await providerService.listProviders({
    ...request.query,
    ...request.pagination,
  });
  response.json({
    success: true,
    message: "Providers fetched successfully.",
    data: result,
  });
};

export const detailsPublic = async (request, response) => {
  const provider = await providerService.getPublicProvider(request.params.id);
  response.json({
    success: true,
    message: "Provider details fetched successfully.",
    data: { provider },
  });
};

export const ownProfile = async (request, response) => {
  const data = await providerService.getOwnProfile(request.user._id);
  response.json({
    success: true,
    message: "Provider profile fetched successfully.",
    data,
  });
};

export const updateOwnProfile = async (request, response) => {
  const data = await providerService.updateOwnProfile(
    request.user._id,
    request.body,
  );
  response.json({
    success: true,
    message: "Provider profile updated successfully.",
    data,
  });
};

export const updateAvailability = async (request, response) => {
  const data = await providerService.updateAvailability(
    request.user._id,
    request.body.availability,
  );
  response.json({
    success: true,
    message: "Provider availability updated successfully.",
    data,
  });
};

export const listAdmin = async (request, response) => {
  const result = await providerService.listProviders({
    ...request.query,
    ...request.pagination,
    admin: true,
  });
  response.json({
    success: true,
    message: "Providers fetched successfully.",
    data: result,
  });
};

export const detailsAdmin = async (request, response) => {
  const provider = await providerService.getAdminProvider(request.params.id);
  response.json({
    success: true,
    message: "Provider details fetched successfully.",
    data: { provider },
  });
};

export const updateApproval = async (request, response) => {
  const provider = await providerService.updateApproval(
    request.params.id,
    request.body.approvalStatus,
  );
  response.json({
    success: true,
    message: "Provider approval updated successfully.",
    data: { provider },
  });
};

export const updateStatus = async (request, response) => {
  const provider = await providerService.updateStatus(
    request.params.id,
    request.body.accountStatus,
  );
  response.json({
    success: true,
    message: "Provider status updated successfully.",
    data: { provider },
  });
};
