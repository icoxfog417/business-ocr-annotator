/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "./API";
type GeneratedMutation<InputType, OutputType> = string & {
  __generatedMutationInput: InputType;
  __generatedMutationOutput: OutputType;
};

export const createAnnotation = /* GraphQL */ `mutation CreateAnnotation(
  $condition: ModelAnnotationConditionInput
  $input: CreateAnnotationInput!
) {
  createAnnotation(condition: $condition, input: $input) {
    answer
    boundingBox
    createdAt
    createdBy
    id
    imageId
    question
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreateAnnotationMutationVariables,
  APITypes.CreateAnnotationMutation
>;
export const createImage = /* GraphQL */ `mutation CreateImage(
  $condition: ModelImageConditionInput
  $input: CreateImageInput!
) {
  createImage(condition: $condition, input: $input) {
    createdAt
    fileName
    id
    metadata
    s3Key
    updatedAt
    uploadedAt
    uploadedBy
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreateImageMutationVariables,
  APITypes.CreateImageMutation
>;
export const deleteAnnotation = /* GraphQL */ `mutation DeleteAnnotation(
  $condition: ModelAnnotationConditionInput
  $input: DeleteAnnotationInput!
) {
  deleteAnnotation(condition: $condition, input: $input) {
    answer
    boundingBox
    createdAt
    createdBy
    id
    imageId
    question
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.DeleteAnnotationMutationVariables,
  APITypes.DeleteAnnotationMutation
>;
export const deleteImage = /* GraphQL */ `mutation DeleteImage(
  $condition: ModelImageConditionInput
  $input: DeleteImageInput!
) {
  deleteImage(condition: $condition, input: $input) {
    createdAt
    fileName
    id
    metadata
    s3Key
    updatedAt
    uploadedAt
    uploadedBy
    __typename
  }
}
` as GeneratedMutation<
  APITypes.DeleteImageMutationVariables,
  APITypes.DeleteImageMutation
>;
export const updateAnnotation = /* GraphQL */ `mutation UpdateAnnotation(
  $condition: ModelAnnotationConditionInput
  $input: UpdateAnnotationInput!
) {
  updateAnnotation(condition: $condition, input: $input) {
    answer
    boundingBox
    createdAt
    createdBy
    id
    imageId
    question
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.UpdateAnnotationMutationVariables,
  APITypes.UpdateAnnotationMutation
>;
export const updateImage = /* GraphQL */ `mutation UpdateImage(
  $condition: ModelImageConditionInput
  $input: UpdateImageInput!
) {
  updateImage(condition: $condition, input: $input) {
    createdAt
    fileName
    id
    metadata
    s3Key
    updatedAt
    uploadedAt
    uploadedBy
    __typename
  }
}
` as GeneratedMutation<
  APITypes.UpdateImageMutationVariables,
  APITypes.UpdateImageMutation
>;
