/* tslint:disable */
 
// this is an auto generated file. This will be overwritten

import * as APITypes from "./API";
type GeneratedSubscription<InputType, OutputType> = string & {
  __generatedSubscriptionInput: InputType;
  __generatedSubscriptionOutput: OutputType;
};

export const onCreateAnnotation = /* GraphQL */ `subscription OnCreateAnnotation(
  $filter: ModelSubscriptionAnnotationFilterInput
) {
  onCreateAnnotation(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnCreateAnnotationSubscriptionVariables,
  APITypes.OnCreateAnnotationSubscription
>;
export const onCreateImage = /* GraphQL */ `subscription OnCreateImage($filter: ModelSubscriptionImageFilterInput) {
  onCreateImage(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnCreateImageSubscriptionVariables,
  APITypes.OnCreateImageSubscription
>;
export const onDeleteAnnotation = /* GraphQL */ `subscription OnDeleteAnnotation(
  $filter: ModelSubscriptionAnnotationFilterInput
) {
  onDeleteAnnotation(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteAnnotationSubscriptionVariables,
  APITypes.OnDeleteAnnotationSubscription
>;
export const onDeleteImage = /* GraphQL */ `subscription OnDeleteImage($filter: ModelSubscriptionImageFilterInput) {
  onDeleteImage(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteImageSubscriptionVariables,
  APITypes.OnDeleteImageSubscription
>;
export const onUpdateAnnotation = /* GraphQL */ `subscription OnUpdateAnnotation(
  $filter: ModelSubscriptionAnnotationFilterInput
) {
  onUpdateAnnotation(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateAnnotationSubscriptionVariables,
  APITypes.OnUpdateAnnotationSubscription
>;
export const onUpdateImage = /* GraphQL */ `subscription OnUpdateImage($filter: ModelSubscriptionImageFilterInput) {
  onUpdateImage(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateImageSubscriptionVariables,
  APITypes.OnUpdateImageSubscription
>;
