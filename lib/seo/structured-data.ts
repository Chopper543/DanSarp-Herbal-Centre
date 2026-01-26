/**
 * Generates JSON-LD structured data for SEO
 */

export interface OrganizationStructuredData {
  name: string;
  url: string;
  logo?: string;
  description?: string;
  address?: {
    streetAddress?: string;
    addressLocality?: string;
    addressRegion?: string;
    postalCode?: string;
    addressCountry?: string;
  };
  contactPoint?: {
    telephone?: string;
    contactType?: string;
    email?: string;
  };
  sameAs?: string[];
}

export interface ArticleStructuredData {
  headline: string;
  description: string;
  image?: string;
  datePublished: string;
  dateModified?: string;
  author: {
    name: string;
    url?: string;
  };
  publisher: {
    name: string;
    logo?: string;
  };
}

/**
 * Generates Organization JSON-LD structured data
 */
export function generateOrganizationStructuredData(
  data: OrganizationStructuredData
): object {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: data.name,
    url: data.url,
    ...(data.logo && { logo: data.logo }),
    ...(data.description && { description: data.description }),
    ...(data.address && {
      address: {
        "@type": "PostalAddress",
        ...data.address,
      },
    }),
    ...(data.contactPoint && {
      contactPoint: {
        "@type": "ContactPoint",
        ...data.contactPoint,
      },
    }),
    ...(data.sameAs && { sameAs: data.sameAs }),
  };
}

/**
 * Generates Article JSON-LD structured data
 */
export function generateArticleStructuredData(
  data: ArticleStructuredData
): object {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: data.headline,
    description: data.description,
    ...(data.image && { image: data.image }),
    datePublished: data.datePublished,
    ...(data.dateModified && { dateModified: data.dateModified }),
    author: {
      "@type": "Person",
      name: data.author.name,
      ...(data.author.url && { url: data.author.url }),
    },
    publisher: {
      "@type": "Organization",
      name: data.publisher.name,
      ...(data.publisher.logo && {
        logo: {
          "@type": "ImageObject",
          url: data.publisher.logo,
        },
      }),
    },
  };
}

/**
 * Generates MedicalBusiness JSON-LD structured data
 */
export function generateMedicalBusinessStructuredData(
  data: OrganizationStructuredData & { medicalSpecialty?: string }
): object {
  return {
    "@context": "https://schema.org",
    "@type": "MedicalBusiness",
    name: data.name,
    url: data.url,
    ...(data.logo && { logo: data.logo }),
    ...(data.description && { description: data.description }),
    ...(data.medicalSpecialty && { medicalSpecialty: data.medicalSpecialty }),
    ...(data.address && {
      address: {
        "@type": "PostalAddress",
        ...data.address,
      },
    }),
    ...(data.contactPoint && {
      contactPoint: {
        "@type": "ContactPoint",
        ...data.contactPoint,
      },
    }),
  };
}
