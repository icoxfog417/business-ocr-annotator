/* tslint:disable */
 
// this is an auto generated file. This will be overwritten

import * as APITypes from "./API";
type GeneratedQuery<InputType, OutputType> = string & {
  __generatedQueryInput: InputType;
  __generatedQueryOutput: OutputType;
};

export const getAnnotation = /* GraphQL */ `query GetAnnotation($id: ID!) {
  getAnnotation(id: $id) {
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
` as GeneratedQuery<
  APITypes.GetAnnotationQueryVariables,
  APITypes.GetAnnotationQuery
>;
export const getImage = /* GraphQL */ `query GetImage($id: ID!) {
  getImage(id: $id) {
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
` as GeneratedQuery<APITypes.GetImageQueryVariables, APITypes.GetImageQuery>;
export const listAnnotations = /* GraphQL */ `query ListAnnotations(
  $filter: ModelAnnotationFilterInput
  $limit: Int
  $nextToken: String
) {
  listAnnotations(filter: $filter, limit: $limit, nextToken: $nextToken) {
    items {
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
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListAnnotationsQueryVariables,
  APITypes.ListAnnotationsQuery
>;
export const listImages = /* GraphQL */ `query ListImages(
  $filter: ModelImageFilterInput
  $limit: Int
  $nextToken: String
) {
  listImages(filter: $filter, limit: $limit, nextToken: $nextToken) {
    items {
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
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListImagesQueryVariables,
  APITypes.ListImagesQuery
>;
